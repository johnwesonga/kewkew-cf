import { env as cloudflareEnv } from 'cloudflare:workers';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
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
			identityPolicy: queues.identityPolicy,
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

	const queueLocations = organization.role === 'admin'
		? await db.select({ id: locations.id, name: locations.name, isActive: locations.isActive })
			.from(locations)
			.where(eq(locations.organizationId, organization.organizationId))
			.orderBy(asc(sql`lower(${locations.name})`), asc(locations.id))
		: [];
	const queueServices = organization.role === 'admin'
		? await db.select({ id: services.id, locationId: services.locationId, name: services.name, isActive: services.isActive })
			.from(services)
			.where(eq(services.organizationId, organization.organizationId))
			.orderBy(asc(sql`lower(${services.name})`), asc(services.id))
		: [];

	return {
		user: { name: locals.user.name, email: locals.user.email },
		organizations: memberships,
		organization,
		locationCount: locationCountRows[0]?.value ?? 0,
		queues: rows,
		queueLocations,
		queueServices,
		createRequestId: organization.role === 'admin' ? crypto.randomUUID() : null,
		created: url.searchParams.get('created') === '1',
		updated: url.searchParams.get('updated') === '1'
	};
};

export const actions: Actions = {
	createQueue: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');
		const userId = locals.user.id;
		const form = await request.formData();
		const organizationId = url.searchParams.get('organization') ?? '';
		const name = String(form.get('queueName') ?? '').trim();
		const locationId = String(form.get('locationId') ?? '');
		const serviceId = String(form.get('serviceId') ?? '');
		const identityPolicy = String(form.get('identityPolicy') ?? '');
		const capacityInput = String(form.get('activeTicketCapacity') ?? '').trim();
		const createRequestId = String(form.get('createRequestId') ?? '');
		const values = { queueName: name, locationId, serviceId, identityPolicy, activeTicketCapacity: capacityInput, createRequestId };
		const invalid = (message: string) => fail(400, { message, ...values });

		if (!organizationId) error(404, 'Workspace not found');
		if (!name || name.length > 160) return invalid('Enter a queue name between 1 and 160 characters.');
		if (!locationId || !serviceId) return invalid('Choose a location and service.');
		if (identityPolicy !== 'anonymous' && identityPolicy !== 'name_required') {
			return invalid('Choose a valid visitor identity policy.');
		}
		if (capacityInput && (!/^[1-9]\d*$/.test(capacityInput) || !Number.isSafeInteger(Number(capacityInput)))) {
			return invalid('Capacity must be a positive whole number, or leave it blank for unlimited capacity.');
		}
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(createRequestId)) {
			return invalid('This form has expired. Reload the page and try again.');
		}

		const db = createDatabase((cloudflareEnv as Env).DB);
		const adminMembership = await db.select({ userId: organizationMemberships.userId })
			.from(organizationMemberships)
			.where(and(
				eq(organizationMemberships.organizationId, organizationId),
				eq(organizationMemberships.userId, userId),
				eq(organizationMemberships.role, 'admin'),
				eq(organizationMemberships.status, 'active')
			))
			.get();
		if (!adminMembership) error(404, 'Workspace not found');

		const validSelection = await db.select({ locationId: locations.id })
			.from(locations)
			.innerJoin(services, and(
				eq(services.organizationId, locations.organizationId),
				eq(services.locationId, locations.id),
				eq(services.id, serviceId)
			))
			.where(and(
				eq(locations.organizationId, organizationId),
				eq(locations.id, locationId)
			))
			.get();
		if (!validSelection) return invalid('Choose a service that belongs to the selected location.');

		const queueId = crypto.randomUUID();
		const now = new Date().toISOString();
		const inserted = await db.insert(queues).select(
			db.select({
				id: sql<string>`${queueId}`.as('id'),
				organizationId: sql<string>`${organizationId}`.as('organization_id'),
				locationId: sql<string>`${locationId}`.as('location_id'),
				serviceId: sql<string>`${serviceId}`.as('service_id'),
				name: sql<string>`${name}`.as('name'),
				identityPolicy: sql<'anonymous' | 'name_required'>`${identityPolicy}`.as('identity_policy'),
				activeTicketCapacity: capacityInput ? sql<number>`${Number(capacityInput)}`.as('active_ticket_capacity') : sql<null>`NULL`.as('active_ticket_capacity'),
				isActive: sql<number>`0`.as('is_active'),
				createdByUserId: sql<string>`${userId}`.as('created_by_user_id'),
				createRequestId: sql<string>`${createRequestId}`.as('create_request_id'),
				createdAt: sql<string>`${now}`.as('created_at'),
				updatedAt: sql<string>`${now}`.as('updated_at')
			})
				.from(organizationMemberships)
				.innerJoin(locations, and(
					eq(locations.organizationId, organizationMemberships.organizationId),
					eq(locations.id, locationId)
				))
				.innerJoin(services, and(
					eq(services.organizationId, locations.organizationId),
					eq(services.locationId, locations.id),
					eq(services.id, serviceId)
				))
				.where(and(
					eq(organizationMemberships.organizationId, organizationId),
					eq(organizationMemberships.userId, userId),
					eq(organizationMemberships.role, 'admin'),
					eq(organizationMemberships.status, 'active')
			))
		).onConflictDoNothing({ target: [queues.organizationId, queues.createdByUserId, queues.createRequestId] }).run();

		if (inserted.meta.changes === 0) {
			const existing = await db.select({ id: queues.id }).from(queues).where(and(
				eq(queues.organizationId, organizationId),
				eq(queues.createdByUserId, userId),
				eq(queues.createRequestId, createRequestId)
			)).get();
			if (!existing) error(404, 'Workspace not found');
		}

		redirect(303, `/staff/queues?organization=${encodeURIComponent(organizationId)}&created=1`);
	}
};
