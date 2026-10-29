import { env as cloudflareEnv } from 'cloudflare:workers';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { and, asc, count, desc, eq, exists, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { locations, membershipLocationAccess, organizationMemberships, organizations, queueSessions, queues, services, tickets } from '#lib/server/schema';
import { presentStaffQueueBoard } from '#lib/staff-queue-board';

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
		sessionState: session?.state ?? null,
		tickets: board.tickets,
		emptyMessage: board.emptyMessage
	};
};
