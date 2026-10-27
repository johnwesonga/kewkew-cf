import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const organizations = sqliteTable('organizations', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const organizationMemberships = sqliteTable('organization_memberships', {
	organizationId: text('organization_id').notNull(),
	userId: text('user_id').notNull(),
	role: text('role', { enum: ['admin', 'operator'] }).notNull(),
	status: text('status', { enum: ['active', 'suspended'] }).notNull()
});

export const locations = sqliteTable('locations', {
	id: text('id').primaryKey(),
	organizationId: text('organization_id').notNull(),
	name: text('name').notNull(),
	timezone: text('timezone').notNull(),
	isActive: integer('is_active').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const membershipLocationAccess = sqliteTable('membership_location_access', {
	organizationId: text('organization_id').notNull(),
	userId: text('user_id').notNull(),
	locationId: text('location_id').notNull()
});
