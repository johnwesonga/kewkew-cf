import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const organizations = sqliteTable('organizations', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const organizationMemberships = sqliteTable('organization_memberships', {
	organizationId: text('organization_id').notNull(),
	userId: text('user_id').notNull(),
	role: text('role', { enum: ['admin', 'operator'] }).notNull(),
	status: text('status', { enum: ['active', 'suspended'] }).notNull(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
}, (table) => [primaryKey({ columns: [table.organizationId, table.userId] })]);

export const locations = sqliteTable('locations', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),
	name: text('name').notNull(),
	timezone: text('timezone').notNull(),
	isActive: integer('is_active').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const services = sqliteTable('services', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),
	locationId: text('location_id').notNull(),
	name: text('name').notNull(),
	description: text('description'),
	isActive: integer('is_active').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const queues = sqliteTable('queues', {
	id: text('id').primaryKey(),
	publicId: text('public_id').notNull(),
	organizationId: text('organization_id').notNull(),
	locationId: text('location_id').notNull(),
	serviceId: text('service_id').notNull(),
	name: text('name').notNull(),
	identityPolicy: text('identity_policy', { enum: ['anonymous', 'name_required'] }).notNull(),
	activeTicketCapacity: integer('active_ticket_capacity'),
	isActive: integer('is_active').notNull(),
	createdByUserId: text('created_by_user_id'),
	createRequestId: text('create_request_id'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
}, (table) => [
	uniqueIndex('queues_create_request_once').on(table.organizationId, table.createdByUserId, table.createRequestId),
	uniqueIndex('queues_public_id_unique').on(table.publicId)
]);

export const queueSessions = sqliteTable('queue_sessions', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),
	queueId: text('queue_id').notNull(),
	state: text('state', { enum: ['open', 'paused', 'closed'] }).notNull(),
	openedAt: text('opened_at').notNull(),
	closedAt: text('closed_at'),
	openRequestId: text('open_request_id'),
	transitionRequestId: text('transition_request_id'),
	nextTicketNumber: integer('next_ticket_number').notNull().default(1),
	nextQueueSequence: integer('next_queue_sequence').notNull().default(1),
	lastJoinAttemptDigest: text('last_join_attempt_digest')
}, (table) => [
	uniqueIndex('queue_sessions_one_current_per_queue')
		.on(table.queueId)
		.where(sql`${table.state} IN ('open', 'paused')`),
	uniqueIndex('queue_sessions_open_request_once')
		.on(table.queueId, table.openRequestId)
]);

export const queueSessionEvents = sqliteTable('queue_session_events', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),
	queueId: text('queue_id').notNull(),
	sessionId: text('session_id').notNull(),
	fromState: text('from_state', { enum: ['open', 'paused'] }).notNull(),
	toState: text('to_state', { enum: ['open', 'paused', 'closed'] }).notNull(),
	actorUserId: text('actor_user_id').notNull(),
	requestId: text('request_id').notNull(),
	occurredAt: text('occurred_at').notNull()
}, (table) => [
	uniqueIndex('queue_session_events_request_once').on(table.requestId),
	uniqueIndex('queue_session_events_by_session_time').on(table.sessionId, table.occurredAt, table.id)
]);

export const tickets = sqliteTable('tickets', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),
	queueId: text('queue_id').notNull(),
	queueSessionId: text('queue_session_id').notNull(),
	ticketNumber: integer('ticket_number').notNull(),
	queueSequence: integer('queue_sequence').notNull(),
	joinAttemptDigest: text('join_attempt_digest').notNull(),
	status: text('status', { enum: ['waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show'] }).notNull(),
	firstName: text('first_name'),
	lastName: text('last_name'),
	identityPolicy: text('identity_policy', { enum: ['anonymous', 'name_required'] }).notNull(),
	joinedAt: text('joined_at').notNull(),
	calledAt: text('called_at'),
	startedAt: text('started_at'),
	completedAt: text('completed_at'),
	cancelledAt: text('cancelled_at'),
	transitionRequestId: text('transition_request_id'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
}, (table) => [
	uniqueIndex('tickets_session_number_unique').on(table.queueSessionId, table.ticketNumber),
	uniqueIndex('tickets_session_sequence_unique').on(table.queueSessionId, table.queueSequence),
	uniqueIndex('tickets_join_attempt_unique').on(table.queueSessionId, table.joinAttemptDigest),
	uniqueIndex('tickets_by_session_status_sequence').on(table.queueSessionId, table.status, table.queueSequence),
	uniqueIndex('tickets_transition_request_unique').on(table.transitionRequestId).where(sql`${table.transitionRequestId} IS NOT NULL`)
]);

export const ticketEvents = sqliteTable('ticket_events', {
	id: text('id').primaryKey(),
	ticketId: text('ticket_id').notNull(),
	fromStatus: text('from_status', { enum: ['waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show'] }),
	toStatus: text('to_status', { enum: ['waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show'] }).notNull(),
	actorType: text('actor_type', { enum: ['visitor', 'staff', 'system'] }).notNull(),
	actorId: text('actor_id'),
	occurredAt: text('occurred_at').notNull(),
	metadata: text('metadata'),
	createdAt: text('created_at').notNull()
}, (table) => [
	uniqueIndex('ticket_events_joined_once').on(table.ticketId)
		.where(sql`${table.fromStatus} IS NULL AND ${table.toStatus} = 'waiting' AND ${table.actorType} = 'visitor'`),
	uniqueIndex('ticket_events_visitor_cancel_once').on(table.ticketId)
		.where(sql`${table.fromStatus} = 'waiting' AND ${table.toStatus} = 'cancelled' AND ${table.actorType} = 'visitor'`),
	uniqueIndex('ticket_events_by_ticket_time').on(table.ticketId, table.occurredAt, table.id)
]);

export const trackingCredentials = sqliteTable('tracking_credentials', {
	id: text('id').primaryKey(),
	ticketId: text('ticket_id').notNull(),
	tokenDigest: text('token_digest').notNull(),
	createdAt: text('created_at').notNull(),
	expiresAt: text('expires_at'),
	revokedAt: text('revoked_at')
}, (table) => [
	uniqueIndex('tracking_credentials_digest_unique').on(table.tokenDigest),
	index('tracking_credentials_by_ticket').on(table.ticketId)
]);

export const browserTicketClaims = sqliteTable('browser_ticket_claims', {
	queueSessionId: text('queue_session_id').notNull(),
	ticketId: text('ticket_id').notNull(),
	credentialDigest: text('credential_digest').notNull(),
	createdAt: text('created_at').notNull()
}, (table) => [
	primaryKey({ columns: [table.queueSessionId, table.credentialDigest] }),
	index('browser_ticket_claims_by_ticket').on(table.ticketId)
]);

export const membershipLocationAccess = sqliteTable('membership_location_access', {
	organizationId: text('organization_id').notNull(),
	userId: text('user_id').notNull(),
	locationId: text('location_id').notNull(),
	createdAt: text('created_at').notNull()
}, (table) => [primaryKey({ columns: [table.organizationId, table.userId, table.locationId] })]);

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull(),
	emailVerified: integer('email_verified').notNull(),
	image: text('image'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const accounts = sqliteTable('accounts', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull(),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: text('access_token_expires_at'),
	refreshTokenExpiresAt: text('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const staffInvitations = sqliteTable('staff_invitations', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),
	invitedEmail: text('invited_email').notNull(),
	role: text('role', { enum: ['admin', 'operator'] }).notNull(),
	locationIdsJson: text('location_ids_json').notNull(),
	tokenDigest: text('token_digest').notNull(),
	createdByUserId: text('created_by_user_id').notNull(),
	createdAt: text('created_at').notNull(),
	expiresAt: text('expires_at').notNull(),
	deliveryState: text('delivery_state', { enum: ['sent', 'failed'] }).notNull(),
	acceptedByUserId: text('accepted_by_user_id'),
	acceptedAt: text('accepted_at'),
	revokedAt: text('revoked_at')
});

export const membershipAuditEvents = sqliteTable('membership_audit_events', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),
	actorUserId: text('actor_user_id').notNull(),
	subjectUserId: text('subject_user_id').notNull(),
	changeType: text('change_type', { enum: ['membership_created', 'role_changed', 'location_access_changed', 'suspended', 'reactivated', 'invitation_accepted'] }).notNull(),
	beforeRole: text('before_role', { enum: ['admin', 'operator'] }),
	afterRole: text('after_role', { enum: ['admin', 'operator'] }),
	beforeStatus: text('before_status', { enum: ['active', 'suspended'] }),
	afterStatus: text('after_status', { enum: ['active', 'suspended'] }),
	detailsJson: text('details_json'),
	createdAt: text('created_at').notNull()
});
