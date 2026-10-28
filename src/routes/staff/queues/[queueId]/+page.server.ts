import { env as cloudflareEnv } from 'cloudflare:workers';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, asc, count, eq, exists, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { locations, organizationMemberships, organizations, queues, services } from '#lib/server/schema';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, '/staff/sign-in');
	const userId = locals.user.id;
	const db = createDatabase((cloudflareEnv as Env).DB);
	const memberships = await db.select({
		organizationId: organizations.id,
		organizationName: organizations.name
	})
		.from(organizationMemberships)
		.innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
		.where(and(
			eq(organizationMemberships.userId, userId),
			eq(organizationMemberships.role, 'admin'),
			eq(organizationMemberships.status, 'active')
		))
		.orderBy(asc(sql`lower(${organizations.name})`), asc(organizations.id));
	if (memberships.length === 0) error(404, 'Queue not found');

	const requestedOrganizationId = url.searchParams.get('organization');
	const organization = requestedOrganizationId
		? memberships.find((membership) => membership.organizationId === requestedOrganizationId)
		: memberships[0];
	if (!organization) error(404, 'Queue not found');

	const [queue, locationCount] = await Promise.all([
		db.select({
			id: queues.id,
			publicId: queues.publicId,
			name: queues.name,
			locationName: locations.name,
			serviceName: services.name,
			identityPolicy: queues.identityPolicy,
			activeTicketCapacity: queues.activeTicketCapacity
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
			.where(and(
				eq(queues.id, params.queueId),
				eq(queues.organizationId, organization.organizationId),
				exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
					eq(organizationMemberships.organizationId, queues.organizationId),
					eq(organizationMemberships.userId, userId),
					eq(organizationMemberships.role, 'admin'),
					eq(organizationMemberships.status, 'active')
				)))
			))
			.get(),
		db.select({ value: count() }).from(locations)
			.where(eq(locations.organizationId, organization.organizationId))
	]);
	if (!queue) error(404, 'Queue not found');

	return {
		user: { name: locals.user.name, email: locals.user.email },
		organization,
		organizations: memberships,
		locationCount: locationCount[0]?.value ?? 0,
		queue
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
		if (!name || name.length > 160) return invalid('Enter a queue name between 1 and 160 characters.');
		if (identityPolicy !== 'anonymous' && identityPolicy !== 'name_required') {
			return invalid('Choose a valid visitor identity policy.');
		}
		if (capacityInput && (!/^[1-9]\d*$/.test(capacityInput) || !Number.isSafeInteger(Number(capacityInput)))) {
			return invalid('Capacity must be a positive whole number, or leave it blank for unlimited capacity.');
		}

		const db = createDatabase((cloudflareEnv as Env).DB);
		const result = await db.update(queues).set({
			name,
			identityPolicy,
			activeTicketCapacity: capacityInput ? Number(capacityInput) : null,
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
