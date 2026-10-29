import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
	transitionRequestId: text('transition_request_id')
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
