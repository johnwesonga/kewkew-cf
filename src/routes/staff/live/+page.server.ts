import { env as cloudflareEnv } from 'cloudflare:workers';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { and, asc, count, eq, exists, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { filterStaffQueues } from '#lib/server/staff-access';
import { locations, membershipLocationAccess, organizationMemberships, organizations, queueSessions, queues, services } from '#lib/server/schema';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, '/staff/sign-in');
	const userId = locals.user.id;
	const db = createDatabase((cloudflareEnv as Env).DB);
	const memberships = await db.select({
		organizationId: organizations.id,
		organizationName: organizations.name,
		role: organizationMemberships.role
	})
		.from(organizationMemberships)
		.innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
		.where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.status, 'active')))
		.orderBy(asc(sql`lower(${organizations.name})`), asc(organizations.id));
	if (!memberships.length) redirect(303, '/staff');

	const requestedOrganizationId = url.searchParams.get('organization');
	const organization = requestedOrganizationId
		? memberships.find(({ organizationId }) => organizationId === requestedOrganizationId)
		: memberships[0];
	if (!organization) error(404, 'Workspace not found');

	const [locationCountRows, assignedLocationRows, rows] = await Promise.all([
		organization.role === 'admin'
			? db.select({ value: count() }).from(locations).where(eq(locations.organizationId, organization.organizationId))
			: db.select({ value: count() }).from(membershipLocationAccess)
				.innerJoin(organizationMemberships, and(
					eq(organizationMemberships.organizationId, membershipLocationAccess.organizationId),
					eq(organizationMemberships.userId, membershipLocationAccess.userId)
				))
				.where(and(
					eq(membershipLocationAccess.organizationId, organization.organizationId),
					eq(membershipLocationAccess.userId, userId),
					eq(organizationMemberships.role, 'operator'),
					eq(organizationMemberships.status, 'active')
				)),
		organization.role === 'operator'
			? db.select({ locationId: membershipLocationAccess.locationId })
				.from(membershipLocationAccess)
				.innerJoin(organizationMemberships, and(
					eq(organizationMemberships.organizationId, membershipLocationAccess.organizationId),
					eq(organizationMemberships.userId, membershipLocationAccess.userId)
				))
				.where(and(
					eq(membershipLocationAccess.organizationId, organization.organizationId),
					eq(membershipLocationAccess.userId, userId),
					eq(organizationMemberships.role, 'operator'),
					eq(organizationMemberships.status, 'active')
				))
			: Promise.resolve([]),
		db.select({
			id: queues.id,
			organizationId: queues.organizationId,
			locationId: locations.id,
			locationName: locations.name,
			locationIsActive: locations.isActive,
			serviceName: services.name,
			serviceIsActive: services.isActive,
			name: queues.name,
			isActive: queues.isActive,
			sessionId: queueSessions.id,
			sessionState: queueSessions.state
		})
			.from(queues)
			.innerJoin(locations, and(
				eq(locations.organizationId, queues.organizationId),
				eq(locations.id, queues.locationId)
			))
			.innerJoin(services, and(
				eq(services.organizationId, queues.organizationId),
				eq(services.locationId, queues.locationId),
				eq(services.id, queues.serviceId)
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
			.orderBy(asc(sql`lower(${locations.name})`), asc(sql`lower(${queues.name})`), asc(queues.id))
	]);
	const queueRows = filterStaffQueues(rows, {
		organizationId: organization.organizationId,
		role: organization.role,
		status: 'active',
		locationIds: assignedLocationRows.map(({ locationId }) => locationId)
	});
	return {
		user: { name: locals.user.name, email: locals.user.email },
		organizations: memberships,
		organization,
		locationCount: locationCountRows[0]?.value ?? 0,
		queues: queueRows.map((queue) => ({
			...queue,
			openRequestId: queue.sessionId ? null : crypto.randomUUID(),
			transitionRequestId: queue.sessionId ? crypto.randomUUID() : null
		})),
		opened: url.searchParams.get('opened') === '1',
		sessionUpdated: url.searchParams.get('sessionUpdated'),
		sessionUnchanged: url.searchParams.get('sessionUnchanged') === '1'
	};
};
