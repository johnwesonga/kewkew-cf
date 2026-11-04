import { env as cloudflareEnv } from 'cloudflare:workers';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, asc, count, eq, exists, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { validateQueueConfiguration } from '#lib/server/queue-rules';
import { locations, membershipLocationAccess, organizationMemberships, organizations, queueSessions, queues, services } from '#lib/server/schema';

export const load: PageServerLoad = async ({ locals, params, url }) => {
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
		.where(and(
			eq(organizationMemberships.userId, userId),
			eq(organizationMemberships.status, 'active')
		))
		.orderBy(asc(sql`lower(${organizations.name})`), asc(organizations.id));
	if (memberships.length === 0) error(404, 'Queue not found');

	const requestedOrganizationId = url.searchParams.get('organization');
	const organization = requestedOrganizationId
		? memberships.find((membership) => membership.organizationId === requestedOrganizationId)
		: memberships[0];
	if (!organization) error(404, 'Queue not found');

	const [queue, adminLocationCount, assignedLocationCount] = await Promise.all([
		db.select({
			id: queues.id,
			publicId: queues.publicId,
			name: queues.name,
			locationName: locations.name,
			timezone: locations.timezone,
			serviceName: services.name,
			identityPolicy: queues.identityPolicy,
			activeTicketCapacity: queues.activeTicketCapacity,
			isActive: queues.isActive,
			locationIsActive: locations.isActive,
			serviceIsActive: services.isActive,
			scheduleEnabled: sql<number>`COALESCE((SELECT enabled FROM queue_schedules WHERE queue_id = ${queues.id}), 0)`,
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
				eq(services.id, queues.serviceId),
				eq(services.locationId, queues.locationId)
			))
			.leftJoin(queueSessions, and(
				eq(queueSessions.organizationId, queues.organizationId),
				eq(queueSessions.queueId, queues.id),
				sql`${queueSessions.state} IN ('open', 'paused')`
			))
			.where(and(
				eq(queues.id, params.queueId),
				eq(queues.organizationId, organization.organizationId),
				organization.role === 'admin'
					? exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
						eq(organizationMemberships.organizationId, queues.organizationId),
						eq(organizationMemberships.userId, userId),
						eq(organizationMemberships.role, 'admin'),
						eq(organizationMemberships.status, 'active')
					)))
					: exists(db.select({ locationId: membershipLocationAccess.locationId }).from(membershipLocationAccess)
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
			))
			.get(),
		db.select({ value: count() }).from(locations).where(eq(locations.organizationId, organization.organizationId)),
		db.select({ value: count() }).from(membershipLocationAccess)
			.where(and(eq(membershipLocationAccess.organizationId, organization.organizationId), eq(membershipLocationAccess.userId, userId)))
	]);
	if (!queue) error(404, 'Queue not found');

	const membership = memberships.find((item) => item.organizationId === organization.organizationId)!;
	return {
		user: { name: locals.user.name, email: locals.user.email },
		organization: { ...organization, role: membership.role },
		organizations: memberships,
		locationCount: membership.role === 'admin' ? adminLocationCount[0]?.value ?? 0 : assignedLocationCount[0]?.value ?? 0,
		queue,
		openRequestId: queue.sessionId ? null : crypto.randomUUID()
	};
};

export const actions: Actions = {
	updateQueue: async ({ locals, params, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');
		const form = await request.formData();
		const organizationId = url.searchParams.get('organization') ?? '';
		const name = String(form.get('queueName') ?? '').trim();
		const identityPolicy = String(form.get('identityPolicy') ?? '');
		const capacityInput = String(form.get('activeTicketCapacity') ?? '').trim();
		const values = { queueName: name, identityPolicy, activeTicketCapacity: capacityInput };
		const invalid = (message: string) => fail(400, { message, ...values });

		if (!organizationId) error(404, 'Queue not found');
		const configuration = validateQueueConfiguration({ name, identityPolicy, capacityInput });
		if (!configuration.valid) return invalid(configuration.message);

		const db = createDatabase((cloudflareEnv as Env).DB);
		const result = await db
			.update(queues)
			.set({
				name: configuration.value.name,
				identityPolicy: configuration.value.identityPolicy,
				activeTicketCapacity: configuration.value.activeTicketCapacity,
				updatedAt: new Date().toISOString()
			}).where(and(
				eq(queues.id, params.queueId),
				eq(queues.organizationId, organizationId),
				exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
					eq(organizationMemberships.organizationId, queues.organizationId),
					eq(organizationMemberships.userId, locals.user.id),
					eq(organizationMemberships.role, 'admin'),
					eq(organizationMemberships.status, 'active')
				)))
			)).run();
		if (result.meta.changes !== 1) error(404, 'Queue not found');

		redirect(303, `/staff/queues?organization=${encodeURIComponent(organizationId)}&updated=1`);
	}
};
