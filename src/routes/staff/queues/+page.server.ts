import { env as cloudflareEnv } from 'cloudflare:workers';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { and, asc, count, eq, exists, sql } from 'drizzle-orm';
import { createDatabase } from '../../../lib/server/database';
import {
	locations,
	membershipLocationAccess,
	organizationMemberships,
	organizations,
	queueSessions,
	queues,
	services
} from '../../../lib/server/schema';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, '/staff/sign-in');
	const userId = locals.user.id;

	const db = createDatabase((cloudflareEnv as Env).DB);
	const memberships = await db
		.select({
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

	if (memberships.length === 0) error(404, 'Workspace not found');

	const requestedOrganizationId = url.searchParams.get('organization');
	const organization = requestedOrganizationId
		? memberships.find((membership) => membership.organizationId === requestedOrganizationId)
		: memberships[0];
	if (!organization) error(404, 'Workspace not found');

	const locationCountRows = organization.role === 'admin'
		? await db.select({ value: count() }).from(locations).where(and(
			eq(locations.organizationId, organization.organizationId),
			exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
				eq(organizationMemberships.organizationId, locations.organizationId),
				eq(organizationMemberships.userId, userId),
				eq(organizationMemberships.role, 'admin'),
				eq(organizationMemberships.status, 'active')
			)))
		))
		: await db.select({ value: count() }).from(membershipLocationAccess)
			.innerJoin(locations, and(
				eq(locations.organizationId, membershipLocationAccess.organizationId),
				eq(locations.id, membershipLocationAccess.locationId)
			))
			.innerJoin(organizationMemberships, and(
				eq(organizationMemberships.organizationId, membershipLocationAccess.organizationId),
				eq(organizationMemberships.userId, membershipLocationAccess.userId)
			))
			.where(and(
				eq(membershipLocationAccess.organizationId, organization.organizationId),
				eq(membershipLocationAccess.userId, userId),
				eq(organizationMemberships.role, 'operator'),
				eq(organizationMemberships.status, 'active')
			));

	const rows = await db
		.select({
			id: queues.id,
			name: queues.name,
			locationId: locations.id,
			locationName: locations.name,
			serviceId: services.id,
			serviceName: services.name,
			isActive: queues.isActive,
			activeTicketCapacity: queues.activeTicketCapacity,
			sessionState: queueSessions.state
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
			sql`${queueSessions.state} IN ('open', 'paused')`
		))
		.where(and(
			eq(queues.organizationId, organization.organizationId),
			organization.role === 'operator'
				? exists(db.select({ locationId: membershipLocationAccess.locationId })
					.from(membershipLocationAccess)
					.innerJoin(organizationMemberships, and(
						eq(organizationMemberships.organizationId, membershipLocationAccess.organizationId),
						eq(organizationMemberships.userId, membershipLocationAccess.userId)
					))
					.where(and(
						eq(membershipLocationAccess.organizationId, queues.organizationId),
						eq(membershipLocationAccess.locationId, queues.locationId),
						eq(membershipLocationAccess.userId, userId),
						eq(organizationMemberships.role, 'operator'),
						eq(organizationMemberships.status, 'active')
					)))
				: exists(db.select({ userId: organizationMemberships.userId })
					.from(organizationMemberships)
					.where(and(
						eq(organizationMemberships.organizationId, queues.organizationId),
						eq(organizationMemberships.userId, userId),
						eq(organizationMemberships.role, 'admin'),
						eq(organizationMemberships.status, 'active')
					)))
		))
		.orderBy(asc(sql`lower(${locations.name})`), asc(sql`lower(${queues.name})`), asc(queues.id));

	return {
		user: { name: locals.user.name, email: locals.user.email },
		organizations: memberships,
		organization,
		locationCount: locationCountRows[0]?.value ?? 0,
		queues: rows
	};
};
