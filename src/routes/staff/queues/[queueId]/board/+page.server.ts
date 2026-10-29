import { env as cloudflareEnv } from 'cloudflare:workers';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, asc, count, desc, eq, exists, inArray, not, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { locations, membershipLocationAccess, organizationMemberships, organizations, queueSessions, queues, services, ticketEvents, tickets } from '#lib/server/schema';
import { presentStaffQueueBoard } from '#lib/staff-queue-board';
import { canCallNext } from '#lib/server/staff-ticket-rules';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, '/staff/sign-in');
	const db = createDatabase((cloudflareEnv as Env).DB);
	const userId = locals.user.id;
	const memberships = await db.select({
		organizationId: organizations.id,
		organizationName: organizations.name,
		role: organizationMemberships.role
	})
		.from(organizationMemberships)
		.innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
		.where(and(
			eq(organizationMemberships.userId, userId),
			eq(organizationMemberships.status, 'active')
		))
		.orderBy(asc(sql`lower(${organizations.name})`), asc(organizations.id));
	if (memberships.length === 0) error(404, 'Queue not found');

	const requestedOrganizationId = url.searchParams.get('organization');
	const organization = requestedOrganizationId
		? memberships.find(({ organizationId }) => organizationId === requestedOrganizationId)
		: memberships[0];
	if (!organization) error(404, 'Queue not found');

	const queue = await db.select({
		id: queues.id,
		name: queues.name,
		organizationId: queues.organizationId,
		locationId: locations.id,
		locationName: locations.name,
		serviceName: services.name
	})
		.from(queues)
		.innerJoin(locations, and(eq(locations.organizationId, queues.organizationId), eq(locations.id, queues.locationId)))
		.innerJoin(services, and(eq(services.organizationId, queues.organizationId), eq(services.locationId, queues.locationId), eq(services.id, queues.serviceId)))
		.where(and(
			eq(queues.id, params.queueId),
			eq(queues.organizationId, organization.organizationId),
			exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
				eq(organizationMemberships.organizationId, queues.organizationId),
				eq(organizationMemberships.userId, userId),
				eq(organizationMemberships.status, 'active')
			))),
			organization.role === 'operator'
				? exists(db.select({ locationId: membershipLocationAccess.locationId })
					.from(membershipLocationAccess)
					.where(and(
						eq(membershipLocationAccess.organizationId, queues.organizationId),
						eq(membershipLocationAccess.userId, userId),
						eq(membershipLocationAccess.locationId, queues.locationId)
					)))
				: exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
					eq(organizationMemberships.organizationId, queues.organizationId),
					eq(organizationMemberships.userId, userId),
					eq(organizationMemberships.role, 'admin'),
					eq(organizationMemberships.status, 'active')
				)))
		))
		.get();
	if (!queue) error(404, 'Queue not found');

	const [locationCountRows, activeSession] = await Promise.all([
		db.select({ value: count() }).from(locations).where(eq(locations.organizationId, organization.organizationId)),
		db.select({ id: queueSessions.id, state: queueSessions.state })
			.from(queueSessions)
			.where(and(
				eq(queueSessions.organizationId, organization.organizationId),
				eq(queueSessions.queueId, queue.id),
				sql`${queueSessions.state} IN ('open', 'paused')`
			))
			.get()
	]);
	const session = activeSession ?? await db.select({ id: queueSessions.id, state: queueSessions.state })
		.from(queueSessions)
		.where(and(eq(queueSessions.organizationId, organization.organizationId), eq(queueSessions.queueId, queue.id)))
		.orderBy(desc(queueSessions.openedAt), desc(queueSessions.id))
		.limit(1)
		.get();
	const ticketRows = activeSession
		? await db.select({
			id: tickets.id,
			ticketNumber: tickets.ticketNumber,
			queueSequence: tickets.queueSequence,
			status: tickets.status,
			identityPolicy: tickets.identityPolicy,
			firstName: sql<string | null>`CASE WHEN ${tickets.identityPolicy} = 'name_required' THEN ${tickets.firstName} ELSE NULL END`.as('first_name'),
			lastName: sql<string | null>`CASE WHEN ${tickets.identityPolicy} = 'name_required' THEN ${tickets.lastName} ELSE NULL END`.as('last_name')
		})
			.from(tickets)
			.where(and(
				eq(tickets.organizationId, organization.organizationId),
				eq(tickets.queueId, queue.id),
				eq(tickets.queueSessionId, activeSession.id),
				sql`${tickets.status} IN ('waiting', 'called', 'serving')`
			))
			.orderBy(asc(tickets.queueSequence), asc(tickets.id))
		: [];
	const board = presentStaffQueueBoard(session?.state ?? null, ticketRows);

	return {
		user: { name: locals.user.name, email: locals.user.email },
		organizations: memberships,
		organization,
		locationCount: locationCountRows[0]?.value ?? 0,
		queue: { id: queue.id, name: queue.name, locationName: queue.locationName, serviceName: queue.serviceName },
		sessionId: activeSession?.id ?? null,
		sessionState: session?.state ?? null,
		tickets: board.tickets,
		canCallNext: canCallNext(session?.state ?? null, board.tickets),
		callRequestId: activeSession ? crypto.randomUUID() : null,
		calledTicket: url.searchParams.get('called'),
		replayedCall: url.searchParams.get('replayed') === '1',
		emptyMessage: board.emptyMessage
	};
};

export const actions: Actions = {
	callNext: async ({ locals, params, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');
		const organizationId = url.searchParams.get('organization') ?? '';
		const form = await request.formData();
		const sessionId = String(form.get('sessionId') ?? '');
		const requestId = String(form.get('requestId') ?? '');
		const invalid = (message: string, status = 400) => fail(status, { message });
		if (!organizationId || !sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
			return invalid('This call form has expired. Refresh the board and try again.');
		}

		const db = createDatabase((cloudflareEnv as Env).DB);
		const userId = locals.user.id;
		const membership = await db.select({ role: organizationMemberships.role })
			.from(organizationMemberships)
			.where(and(
				eq(organizationMemberships.organizationId, organizationId),
				eq(organizationMemberships.userId, userId),
				eq(organizationMemberships.status, 'active')
			))
			.get();
		if (!membership) error(404, 'Queue not found');

		const queue = await db.select({ id: queues.id, locationId: queues.locationId })
			.from(queues)
			.where(and(eq(queues.id, params.queueId), eq(queues.organizationId, organizationId)))
			.get();
		if (!queue) error(404, 'Queue not found');
		const activeLocationAccess = membership.role === 'admin'
			? await db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
				eq(organizationMemberships.organizationId, organizationId),
				eq(organizationMemberships.userId, userId),
				eq(organizationMemberships.role, 'admin'),
				eq(organizationMemberships.status, 'active')
			)).get()
			: await db.select({ locationId: membershipLocationAccess.locationId })
				.from(membershipLocationAccess)
				.innerJoin(organizationMemberships, and(
					eq(organizationMemberships.organizationId, membershipLocationAccess.organizationId),
					eq(organizationMemberships.userId, membershipLocationAccess.userId)
				))
				.where(and(
					eq(membershipLocationAccess.organizationId, organizationId),
					eq(membershipLocationAccess.userId, userId),
					eq(membershipLocationAccess.locationId, queue.locationId),
					eq(organizationMemberships.role, 'operator'),
					eq(organizationMemberships.status, 'active')
				))
				.get();
		if (!activeLocationAccess) error(404, 'Queue not found');

		const previousUse = await db.select({
			ticketNumber: tickets.ticketNumber,
			organizationId: tickets.organizationId,
			queueId: tickets.queueId,
			queueSessionId: tickets.queueSessionId
		})
			.from(tickets)
			.where(eq(tickets.transitionRequestId, requestId))
			.get();
		if (previousUse) {
			if (previousUse.organizationId === organizationId && previousUse.queueId === queue.id && previousUse.queueSessionId === sessionId) {
				redirect(303, `/staff/queues/${encodeURIComponent(queue.id)}/board?organization=${encodeURIComponent(organizationId)}&called=${previousUse.ticketNumber}&replayed=1`);
			}
			return invalid('This call request was already used. Refresh the board and try again.', 409);
		}

		const activeSession = await db.select({ id: queueSessions.id })
			.from(queueSessions)
			.where(and(
				eq(queueSessions.id, sessionId),
				eq(queueSessions.organizationId, organizationId),
				eq(queueSessions.queueId, queue.id),
				inArray(queueSessions.state, ['open', 'paused'])
			))
			.get();
		if (!activeSession) return fail(409, { message: 'This session is no longer active. Refresh the board and try again.' });

		const operatorAssignment = exists(db.select({ locationId: membershipLocationAccess.locationId })
			.from(membershipLocationAccess)
			.innerJoin(organizationMemberships, and(
				eq(organizationMemberships.organizationId, membershipLocationAccess.organizationId),
				eq(organizationMemberships.userId, membershipLocationAccess.userId)
			))
			.where(and(
				eq(membershipLocationAccess.organizationId, queueSessions.organizationId),
				eq(membershipLocationAccess.userId, userId),
				eq(membershipLocationAccess.locationId, queues.locationId),
				eq(organizationMemberships.role, 'operator'),
				eq(organizationMemberships.status, 'active')
			)));
		const activeAdmin = exists(db.select({ userId: organizationMemberships.userId })
			.from(organizationMemberships)
			.where(and(
				eq(organizationMemberships.organizationId, queueSessions.organizationId),
				eq(organizationMemberships.userId, userId),
				eq(organizationMemberships.role, 'admin'),
				eq(organizationMemberships.status, 'active')
			)));
		const authorizedMembership = exists(db.select({ userId: organizationMemberships.userId })
			.from(organizationMemberships)
			.where(and(
				eq(organizationMemberships.organizationId, queueSessions.organizationId),
				eq(organizationMemberships.userId, userId),
				eq(organizationMemberships.status, 'active')
			)));
		const canOperateQueue = membership.role === 'admin' ? activeAdmin : operatorAssignment;
		const candidate = db.select({ id: tickets.id })
			.from(tickets)
			.innerJoin(queueSessions, and(
				eq(queueSessions.id, tickets.queueSessionId),
				eq(queueSessions.organizationId, tickets.organizationId),
				eq(queueSessions.queueId, tickets.queueId)
			))
			.innerJoin(queues, and(
				eq(queues.id, tickets.queueId),
				eq(queues.organizationId, tickets.organizationId)
			))
			.where(and(
				eq(tickets.organizationId, organizationId),
				eq(tickets.queueId, queue.id),
				eq(tickets.queueSessionId, activeSession.id),
				eq(tickets.status, 'waiting'),
				inArray(queueSessions.state, ['open', 'paused']),
				authorizedMembership,
				canOperateQueue,
				not(exists(db.select({ id: tickets.id }).from(tickets).where(eq(tickets.transitionRequestId, requestId))))
			))
			.orderBy(asc(tickets.queueSequence), asc(tickets.id))
			.limit(1);

		const now = new Date().toISOString();
		const update = db.update(tickets).set({
			status: 'called',
			calledAt: now,
			transitionRequestId: requestId,
			updatedAt: now
		}).where(and(
			eq(tickets.status, 'waiting'),
			inArray(tickets.id, candidate),
			not(exists(db.select({ id: tickets.id }).from(tickets).where(eq(tickets.transitionRequestId, requestId))))
		));
		const event = db.insert(ticketEvents).select(db.select({
			id: sql<string>`${crypto.randomUUID()}`.as('id'),
			ticketId: tickets.id,
			fromStatus: sql<'waiting'>`'waiting'`.as('from_status'),
			toStatus: sql<'called'>`'called'`.as('to_status'),
			actorType: sql<'staff'>`'staff'`.as('actor_type'),
			actorId: sql<string>`${userId}`.as('actor_id'),
			occurredAt: sql<string>`${now}`.as('occurred_at'),
			metadata: sql<string>`${JSON.stringify({ requestId })}`.as('metadata'),
			createdAt: sql<string>`${now}`.as('created_at')
		}).from(tickets).where(and(
			eq(tickets.organizationId, organizationId),
			eq(tickets.queueId, queue.id),
			eq(tickets.queueSessionId, activeSession.id),
			eq(tickets.transitionRequestId, requestId),
			eq(tickets.status, 'called')
		))).onConflictDoNothing();
		let calledTicketNumber: number | undefined;
		try {
			const result = await db.batch([update, event]);
			if (result[0]?.meta.changes === 1 && result[1]?.meta.changes === 1) {
				const calledTicket = await db.select({ ticketNumber: tickets.ticketNumber }).from(tickets)
					.where(and(eq(tickets.transitionRequestId, requestId), eq(tickets.queueSessionId, sessionId))).get();
				calledTicketNumber = calledTicket?.ticketNumber;
			}
		} catch (cause) {
			console.error('Failed to call next queue ticket', cause instanceof Error ? cause.message : 'Unknown database error');
			return fail(500, { message: 'The next visitor could not be called. Refresh the board and try again.' });
		}
		if (calledTicketNumber !== undefined) redirect(303, `/staff/queues/${encodeURIComponent(queue.id)}/board?organization=${encodeURIComponent(organizationId)}&called=${calledTicketNumber}`);

		const currentSession = await db.select({ id: queueSessions.id }).from(queueSessions)
			.where(and(
				eq(queueSessions.id, sessionId),
				eq(queueSessions.queueId, queue.id),
				eq(queueSessions.organizationId, organizationId),
				inArray(queueSessions.state, ['open', 'paused'])
			)).get();
		if (!currentSession) return fail(409, { message: 'The session changed before the call completed. Refresh the board.' });
		const waiting = await db.select({ id: tickets.id }).from(tickets)
			.where(and(eq(tickets.queueSessionId, sessionId), eq(tickets.status, 'waiting')))
			.limit(1)
			.get();
		if (!waiting) return fail(409, { message: 'Nobody is waiting in this queue.' });
		return fail(409, { message: 'The queue changed before the call completed. Refresh the board and try again.' });
	}
};
