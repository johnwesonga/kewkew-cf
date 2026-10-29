import { and, count, eq, exists, inArray, isNull, not, or, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import {
	browserTicketClaims,
	locations,
	queueSessions,
	queues,
	services,
	ticketEvents,
	tickets,
	trackingCredentials
} from '#lib/server/schema';

const activeStatuses = ['waiting', 'called', 'serving'] as const;

export async function digestCredential(value: string): Promise<string> {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateCredential(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function isValidCredential(value: string): boolean {
	if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
	try {
		const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '=';
		return atob(base64).length === 32;
	} catch {
		return false;
	}
}

export async function findActiveBrowserTicket(
	db: ReturnType<typeof createDatabase>,
	publicId: string,
	browserDigest: string
): Promise<{ id: string } | undefined> {
	return db.select({ id: tickets.id })
		.from(browserTicketClaims)
		.innerJoin(tickets, eq(tickets.id, browserTicketClaims.ticketId))
		.innerJoin(queueSessions, eq(queueSessions.id, tickets.queueSessionId))
		.innerJoin(queues, and(
			eq(queues.id, queueSessions.queueId),
			eq(queues.organizationId, queueSessions.organizationId)
		))
		.innerJoin(locations, and(
			eq(locations.id, queues.locationId),
			eq(locations.organizationId, queues.organizationId)
		))
		.innerJoin(services, and(
			eq(services.id, queues.serviceId),
			eq(services.organizationId, queues.organizationId),
			eq(services.locationId, queues.locationId)
		))
		.where(and(
			eq(queues.publicId, publicId),
			eq(queues.isActive, 1),
			eq(locations.isActive, 1),
			eq(services.isActive, 1),
			eq(browserTicketClaims.credentialDigest, browserDigest),
			inArray(tickets.status, activeStatuses)
		))
		.orderBy(sql`${queueSessions.openedAt} DESC`)
		.limit(1)
		.get();
}

export async function storeTrackingCredential(
	db: ReturnType<typeof createDatabase>,
	ticketId: string,
	tokenDigest: string
): Promise<void> {
	await db.insert(trackingCredentials).values({
		id: crypto.randomUUID(),
		ticketId,
		tokenDigest,
		createdAt: new Date().toISOString(),
		expiresAt: null,
		revokedAt: null
	}).onConflictDoNothing().run();
}

export async function findOrCreateTrackingCredential(
	db: ReturnType<typeof createDatabase>, ticketId: string, tokenDigest: string
): Promise<void> {
	const existing = await db.select({ id: trackingCredentials.id }).from(trackingCredentials)
		.where(eq(trackingCredentials.tokenDigest, tokenDigest)).get();
	if (existing) return;
	await storeTrackingCredential(db, ticketId, tokenDigest);
}

export async function joinVisitorQueue(
	db: ReturnType<typeof createDatabase>,
	args: { publicId: string; attemptToken: string; browserDigest?: string; firstName?: string; lastName?: string }
): Promise<'created_or_replayed' | 'browser_already_joined' | 'name_required' | 'unavailable' | 'full' | 'failed'> {
	const { publicId, attemptToken, browserDigest } = args;
	const attemptDigest = await digestCredential(attemptToken);
	const firstName = args.firstName?.trim() || null;
	const lastName = args.lastName?.trim() || null;
	const eligibleQueue = exists(db.select({ id: queues.id })
		.from(queues)
		.innerJoin(locations, and(
			eq(locations.organizationId, queues.organizationId),
			eq(locations.id, queues.locationId)
		))
		.innerJoin(services, and(
			eq(services.organizationId, queues.organizationId),
			eq(services.id, queues.serviceId),
			eq(services.locationId, queues.locationId)
		))
		.where(and(
			eq(queues.publicId, publicId),
			eq(queues.id, queueSessions.queueId),
			eq(queues.organizationId, queueSessions.organizationId),
			or(
				and(eq(queues.identityPolicy, 'anonymous'), isNull(sql`${firstName}`), isNull(sql`${lastName}`)),
				and(eq(queues.identityPolicy, 'name_required'), not(isNull(sql`${firstName}`)), not(isNull(sql`${lastName}`)), sql`length(trim(${firstName})) > 0 AND length(trim(${lastName})) > 0`)
			),
			eq(queues.isActive, 1),
			eq(locations.isActive, 1),
			eq(services.isActive, 1),
			or(
					isNull(queues.activeTicketCapacity),
				sql`(${db.select({ value: count() }).from(tickets).where(and(
					eq(tickets.queueSessionId, queueSessions.id),
					inArray(tickets.status, activeStatuses)
				))}) < ${queues.activeTicketCapacity}`
			)
		)));
	const priorAttempt = exists(db.select({ id: tickets.id }).from(tickets).where(and(
		eq(tickets.queueSessionId, queueSessions.id),
		eq(tickets.joinAttemptDigest, attemptDigest)
	)));
	const priorTrackingCredential = exists(db.select({ id: trackingCredentials.id })
		.from(trackingCredentials)
		.where(eq(trackingCredentials.tokenDigest, attemptDigest)));
	const currentBrowserClaim = browserDigest
		? exists(db.select({ ticketId: browserTicketClaims.ticketId })
			.from(browserTicketClaims)
			.innerJoin(tickets, eq(tickets.id, browserTicketClaims.ticketId))
			.where(and(
				eq(browserTicketClaims.queueSessionId, queueSessions.id),
				eq(browserTicketClaims.credentialDigest, browserDigest),
				inArray(tickets.status, activeStatuses)
			)))
		: undefined;
	const now = new Date().toISOString();
	const updateConditions = [
		eq(queueSessions.state, 'open'),
		eligibleQueue,
		not(priorAttempt),
		not(priorTrackingCredential)
	];
	if (currentBrowserClaim) updateConditions.push(not(currentBrowserClaim));
	const update = db.update(queueSessions).set({
		nextTicketNumber: sql`${queueSessions.nextTicketNumber} + 1`,
		nextQueueSequence: sql`${queueSessions.nextQueueSequence} + 1`,
		lastJoinAttemptDigest: attemptDigest
	}).where(and(...updateConditions));

	const ticketInsert = db.insert(tickets).select(db.select({
		id: sql<string>`${crypto.randomUUID()}`.as('id'),
		organizationId: queueSessions.organizationId,
		queueId: queueSessions.queueId,
		queueSessionId: queueSessions.id,
		ticketNumber: sql<number>`${queueSessions.nextTicketNumber} - 1`.as('ticket_number'),
		queueSequence: sql<number>`${queueSessions.nextQueueSequence} - 1`.as('queue_sequence'),
		joinAttemptDigest: sql<string>`${attemptDigest}`.as('join_attempt_digest'),
		status: sql<'waiting'>`'waiting'`.as('status'),
		firstName: sql<string | null>`${firstName}`.as('first_name'),
		lastName: sql<string | null>`${lastName}`.as('last_name'),
		identityPolicy: sql<'anonymous' | 'name_required'>`(
			SELECT identity_policy FROM queues WHERE id = ${queueSessions.queueId}
		)`.as('identity_policy'),
		joinedAt: sql<string>`${now}`.as('joined_at'),
		calledAt: sql<null>`NULL`.as('called_at'),
		startedAt: sql<null>`NULL`.as('started_at'),
		completedAt: sql<null>`NULL`.as('completed_at'),
		cancelledAt: sql<null>`NULL`.as('cancelled_at'),
		createdAt: sql<string>`${now}`.as('created_at'),
		updatedAt: sql<string>`${now}`.as('updated_at')
	}).from(queueSessions).where(and(
		eq(queueSessions.state, 'open'),
		eq(queueSessions.lastJoinAttemptDigest, attemptDigest)
	))).onConflictDoNothing();
	const initialEvent = db.insert(ticketEvents).select(db.select({
		id: sql<string>`${crypto.randomUUID()}`.as('id'),
		ticketId: tickets.id,
		fromStatus: sql<null>`NULL`.as('from_status'),
		toStatus: sql<'waiting'>`'waiting'`.as('to_status'),
		actorType: sql<'visitor'>`'visitor'`.as('actor_type'),
		actorId: sql<null>`NULL`.as('actor_id'),
		occurredAt: sql<string>`${now}`.as('occurred_at'),
		metadata: sql<null>`NULL`.as('metadata'),
		createdAt: sql<string>`${now}`.as('created_at')
	}).from(tickets).where(and(
		eq(tickets.joinAttemptDigest, attemptDigest),
		not(exists(db.select({ id: ticketEvents.id }).from(ticketEvents).where(and(
			eq(ticketEvents.ticketId, tickets.id),
			sql`${ticketEvents.fromStatus} IS NULL`,
			eq(ticketEvents.toStatus, 'waiting'),
			eq(ticketEvents.actorType, 'visitor')
		))))
	))).onConflictDoNothing();
	const credentialInsert = db.insert(trackingCredentials).select(db.select({
		id: sql<string>`${crypto.randomUUID()}`.as('id'),
		ticketId: tickets.id,
		tokenDigest: sql<string>`${attemptDigest}`.as('token_digest'),
		createdAt: sql<string>`${now}`.as('created_at'),
		expiresAt: sql<null>`NULL`.as('expires_at'),
		revokedAt: sql<null>`NULL`.as('revoked_at')
	}).from(tickets).where(eq(tickets.joinAttemptDigest, attemptDigest))).onConflictDoNothing();
	const operations: unknown[] = [update, ticketInsert, initialEvent, credentialInsert];
	if (browserDigest) {
		const claimInsert = db.insert(browserTicketClaims).select(db.select({
			queueSessionId: tickets.queueSessionId,
			ticketId: tickets.id,
			credentialDigest: sql<string>`${browserDigest}`.as('credential_digest'),
			createdAt: sql<string>`${now}`.as('created_at')
		}).from(tickets).where(eq(tickets.joinAttemptDigest, attemptDigest)))
			.onConflictDoUpdate({
				target: [browserTicketClaims.queueSessionId, browserTicketClaims.credentialDigest],
				set: { ticketId: sql`excluded.ticket_id`, createdAt: now }
			});
		operations.push(claimInsert);
	}
	await db.batch(operations as unknown as Parameters<typeof db.batch>[0]);

	const replay = await db.select({ id: tickets.id })
		.from(tickets)
		.innerJoin(queueSessions, eq(queueSessions.id, tickets.queueSessionId))
		.innerJoin(queues, and(
			eq(queues.id, queueSessions.queueId),
			eq(queues.organizationId, queueSessions.organizationId)
		))
		.where(and(eq(queues.publicId, publicId), eq(tickets.joinAttemptDigest, attemptDigest)))
		.get();
	if (replay) return 'created_or_replayed';

	if (browserDigest) {
		const existing = await findActiveBrowserTicket(db, publicId, browserDigest);
		if (existing) {
			await findOrCreateTrackingCredential(db, existing.id, attemptDigest);
			return 'browser_already_joined';
		}
	}

	const state = await getJoinState(db, publicId);
	if (!state) return 'unavailable';
	if (state.identityPolicy === 'name_required' && (!firstName || !lastName)) return 'name_required';
	if (state.queueActive !== 1 || state.locationActive !== 1 || state.serviceActive !== 1 || state.sessionState !== 'open') return 'unavailable';
	if (state.activeTicketCapacity !== null && state.activeTicketCount >= state.activeTicketCapacity) return 'full';
	return 'failed';
}

export async function getJoinState(db: ReturnType<typeof createDatabase>, publicId: string) {
	const state = await db.select({
		identityPolicy: queues.identityPolicy,
		queueActive: queues.isActive,
		locationActive: locations.isActive,
		serviceActive: services.isActive,
		sessionState: queueSessions.state,
		activeTicketCapacity: queues.activeTicketCapacity,
		activeTicketCount: sql<number>`(
			SELECT COUNT(*) FROM tickets
			WHERE tickets.queue_session_id = ${queueSessions.id}
			AND tickets.status IN ('waiting', 'called', 'serving')
		)`
	})
		.from(queues)
		.innerJoin(locations, and(
			eq(locations.organizationId, queues.organizationId),
			eq(locations.id, queues.locationId)
		))
		.innerJoin(services, and(
			eq(services.organizationId, queues.organizationId),
			eq(services.id, queues.serviceId),
			eq(services.locationId, queues.locationId)
		))
		.leftJoin(queueSessions, and(
			eq(queueSessions.organizationId, queues.organizationId),
			eq(queueSessions.queueId, queues.id),
			or(eq(queueSessions.state, 'open'), eq(queueSessions.state, 'paused'))
		))
		.where(eq(queues.publicId, publicId))
		.get();
	return state;
}

export async function getTicketByTrackingCredential(db: ReturnType<typeof createDatabase>, tokenDigest: string) {
	const ticket = await db.select({
		id: tickets.id,
		ticketNumber: tickets.ticketNumber,
		queueSequence: tickets.queueSequence,
		status: tickets.status,
		queueName: queues.name,
		serviceName: services.name,
		locationName: locations.name,
		sessionId: queueSessions.id,
		credentialId: trackingCredentials.id,
		expiresAt: trackingCredentials.expiresAt,
		revokedAt: trackingCredentials.revokedAt,
		position: sql<number>`(
			SELECT COUNT(*) FROM tickets AS ahead
			WHERE ahead.queue_session_id = ${tickets.queueSessionId}
			AND ahead.queue_sequence <= ${tickets.queueSequence}
			AND ahead.status IN ('waiting', 'called', 'serving')
		)`
	})
		.from(trackingCredentials)
		.innerJoin(tickets, eq(tickets.id, trackingCredentials.ticketId))
		.innerJoin(queueSessions, and(
			eq(queueSessions.id, tickets.queueSessionId),
			eq(queueSessions.organizationId, tickets.organizationId),
			eq(queueSessions.queueId, tickets.queueId)
		))
		.innerJoin(queues, and(
			eq(queues.id, tickets.queueId),
			eq(queues.organizationId, tickets.organizationId)
		))
		.innerJoin(locations, and(
			eq(locations.id, queues.locationId),
			eq(locations.organizationId, queues.organizationId)
		))
		.innerJoin(services, and(
			eq(services.id, queues.serviceId),
			eq(services.organizationId, queues.organizationId),
			eq(services.locationId, queues.locationId)
		))
		.where(eq(trackingCredentials.tokenDigest, tokenDigest))
		.get();
	if (!ticket || ticket.revokedAt || (ticket.expiresAt && ticket.expiresAt <= new Date().toISOString())) return null;
	return ticket;
}

export async function findTrackedCredentialForBrowserTicket(
	db: ReturnType<typeof createDatabase>, publicId: string, browserDigest: string
): Promise<string | undefined> {
	return db.select({ tokenDigest: trackingCredentials.tokenDigest })
		.from(browserTicketClaims)
		.innerJoin(tickets, eq(tickets.id, browserTicketClaims.ticketId))
		.innerJoin(queueSessions, eq(queueSessions.id, tickets.queueSessionId))
		.innerJoin(queues, and(eq(queues.id, tickets.queueId), eq(queues.organizationId, tickets.organizationId)))
		.innerJoin(trackingCredentials, eq(trackingCredentials.ticketId, tickets.id))
		.where(and(
			eq(queues.publicId, publicId),
			eq(browserTicketClaims.credentialDigest, browserDigest),
			inArray(tickets.status, activeStatuses),
			isNull(trackingCredentials.revokedAt),
			or(isNull(trackingCredentials.expiresAt), sql`${trackingCredentials.expiresAt} > ${new Date().toISOString()}`)
		))
		.orderBy(sql`${trackingCredentials.createdAt} DESC`)
		.limit(1)
		.get()
		.then((row) => row?.tokenDigest);
}
