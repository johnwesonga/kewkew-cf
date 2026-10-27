import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env as cloudflareEnv } from 'cloudflare:workers';
import { createAuth } from '../../lib/server/auth';
import { createDatabase } from '../../lib/server/database';
import { and, asc, eq, exists, sql } from 'drizzle-orm';
import { locations, membershipLocationAccess, organizationMemberships, organizations, services } from '../../lib/server/schema';
import { isValidIanaTimezone } from '../../lib/timezones';

type Membership = {
	organizationId: string;
	organizationName: string;
	role: 'admin' | 'operator';
};

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, '/staff/sign-in');

	const env = cloudflareEnv as Env;
	const db = createDatabase(env.DB);
	const memberships = await db
		.select({
			organizationId: organizations.id,
			organizationName: organizations.name,
			role: organizationMemberships.role
		})
		.from(organizationMemberships)
		.innerJoin(
			organizations,
			eq(organizations.id, organizationMemberships.organizationId)
		)
		.where(
			and(
				eq(organizationMemberships.userId, locals.user.id),
				eq(organizationMemberships.status, 'active')
			)
		)
		.orderBy(asc(sql`lower(${organizations.name})`), asc(organizations.id));

	if (memberships.length === 0) {
		return {
			user: { name: locals.user.name, email: locals.user.email },
			organizations: [],
			organization: null,
			locations: [],
			services: []
		};
	}

	const requestedOrganizationId = url.searchParams.get('organization');
	const organization = requestedOrganizationId
		? memberships.find((membership) => membership.organizationId === requestedOrganizationId)
		: memberships[0];

	if (!organization) error(404, 'Workspace not found');

	const locationsResult = organization.role === 'admin'
		? await db
			.select({ id: locations.id, name: locations.name, timezone: locations.timezone, isActive: locations.isActive })
			.from(locations)
			.where(and(
				eq(locations.organizationId, organization.organizationId),
				exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
					eq(organizationMemberships.organizationId, locations.organizationId),
					eq(organizationMemberships.userId, locals.user.id),
					eq(organizationMemberships.role, 'admin'),
					eq(organizationMemberships.status, 'active')
				)))
			))
			.orderBy(asc(sql`lower(${locations.name})`), asc(locations.id))
		: await db
			.select({ id: locations.id, name: locations.name, timezone: locations.timezone, isActive: locations.isActive })
			.from(membershipLocationAccess)
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
				eq(membershipLocationAccess.userId, locals.user.id),
				eq(organizationMemberships.role, 'operator'),
				eq(organizationMemberships.status, 'active')
			))
			.orderBy(asc(sql`lower(${locations.name})`), asc(locations.id));
	const servicesResult = organization.role === 'admin'
		? await db
			.select({ id: services.id, locationId: services.locationId, name: services.name, description: services.description, isActive: services.isActive })
			.from(services)
			.innerJoin(locations, and(
				eq(locations.organizationId, services.organizationId),
				eq(locations.id, services.locationId)
			))
			.where(and(
				eq(services.organizationId, organization.organizationId),
				exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
					eq(organizationMemberships.organizationId, services.organizationId),
					eq(organizationMemberships.userId, locals.user.id),
					eq(organizationMemberships.role, 'admin'),
					eq(organizationMemberships.status, 'active')
				)))
			))
			.orderBy(asc(sql`lower(${locations.name})`), asc(sql`lower(${services.name})`), asc(services.id))
		: await db
			.select({ id: services.id, locationId: services.locationId, name: services.name, description: services.description, isActive: services.isActive })
			.from(membershipLocationAccess)
			.innerJoin(locations, and(
				eq(locations.organizationId, membershipLocationAccess.organizationId),
				eq(locations.id, membershipLocationAccess.locationId)
			))
			.innerJoin(services, and(
				eq(services.organizationId, locations.organizationId),
				eq(services.locationId, locations.id)
			))
			.innerJoin(organizationMemberships, and(
				eq(organizationMemberships.organizationId, membershipLocationAccess.organizationId),
				eq(organizationMemberships.userId, membershipLocationAccess.userId)
			))
			.where(and(
				eq(membershipLocationAccess.organizationId, organization.organizationId),
				eq(membershipLocationAccess.userId, locals.user.id),
				eq(organizationMemberships.role, 'operator'),
				eq(organizationMemberships.status, 'active')
			))
			.orderBy(asc(sql`lower(${locations.name})`), asc(sql`lower(${services.name})`), asc(services.id));

	return {
		user: { name: locals.user.name, email: locals.user.email },
		organizations: memberships,
		organization,
		locations: locationsResult,
		services: servicesResult
	};
};

export const actions: Actions = {
	updateOrganization: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');

		const form = await request.formData();
		const organizationId = url.searchParams.get('organization') ?? '';
		const name = String(form.get('organizationName') ?? '').trim();

		if (!organizationId || !name || name.length > 160) {
			return fail(400, { message: 'Enter an organization name between 1 and 160 characters.' });
		}

		const env = cloudflareEnv as Env;
		const db = createDatabase(env.DB);
		const result = await db
			.update(organizations)
			.set({ name, updatedAt: new Date().toISOString() })
			.where(
				and(
					eq(organizations.id, organizationId),
					exists(
						db
							.select({ id: organizationMemberships.userId })
							.from(organizationMemberships)
							.where(
								and(
									eq(organizationMemberships.organizationId, organizations.id),
									eq(organizationMemberships.userId, locals.user.id),
									eq(organizationMemberships.role, 'admin'),
									eq(organizationMemberships.status, 'active')
								)
							)
					)
				)
			)
			.run();

		if (result.meta.changes !== 1) error(404, 'Workspace not found');

		return { success: 'Organization name updated.' };
	},
	createLocation: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');

		const form = await request.formData();
		const organizationId = url.searchParams.get('organization') ?? '';
		const name = String(form.get('locationName') ?? '').trim();
		const timezone = String(form.get('timezone') ?? '').trim();

		if (!name || name.length > 160) {
			return fail(400, { message: 'Enter a location name between 1 and 160 characters.' });
		}
		if (!isValidIanaTimezone(timezone)) {
			return fail(400, { message: 'Enter a valid IANA timezone, such as Africa/Nairobi.' });
		}

		const env = cloudflareEnv as Env;
		const db = createDatabase(env.DB);
		const locationId = crypto.randomUUID();
		const now = new Date().toISOString();
		const result = await db
			.insert(locations)
			.select(
				db
					.select({
						id: sql<string>`${locationId}`.as('id'),
						organizationId: sql<string>`${organizationId}`.as('organization_id'),
						name: sql<string>`${name}`.as('name'),
						timezone: sql<string>`${timezone}`.as('timezone'),
						isActive: sql<number>`1`.as('is_active'),
						updatedAt: sql<string>`${now}`.as('updated_at')
					})
					.from(organizationMemberships)
					.where(
						and(
							eq(organizationMemberships.organizationId, organizationId),
							eq(organizationMemberships.userId, locals.user.id),
							eq(organizationMemberships.role, 'admin'),
							eq(organizationMemberships.status, 'active')
						)
					)
			)
			.run();

		if (result.meta.changes !== 1) error(404, 'Workspace not found');

		return { success: `Location “${name}” created.` };
	},
	updateLocation: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');

		const form = await request.formData();
		const organizationId = url.searchParams.get('organization') ?? '';
		const locationId = url.searchParams.get('location') ?? '';
		const name = String(form.get('locationName') ?? '').trim();
		const timezone = String(form.get('timezone') ?? '').trim();

		if (!name || name.length > 160) {
			return fail(400, { message: 'Enter a location name between 1 and 160 characters.' });
		}
		if (!isValidIanaTimezone(timezone)) {
			return fail(400, { message: 'Enter a valid IANA timezone, such as Africa/Nairobi.' });
		}

		const env = cloudflareEnv as Env;
		const db = createDatabase(env.DB);
		const result = await db
			.update(locations)
			.set({ name, timezone, updatedAt: new Date().toISOString() })
			.where(
				and(
					eq(locations.id, locationId),
					eq(locations.organizationId, organizationId),
					exists(
						db
							.select({ userId: organizationMemberships.userId })
							.from(organizationMemberships)
							.where(
								and(
									eq(organizationMemberships.organizationId, locations.organizationId),
									eq(organizationMemberships.userId, locals.user.id),
									eq(organizationMemberships.role, 'admin'),
									eq(organizationMemberships.status, 'active')
								)
							)
					)
				)
			)
			.run();

		if (result.meta.changes !== 1) error(404, 'Location not found');

		return { success: `Location “${name}” updated.` };
	},
	setLocationStatus: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');

		const form = await request.formData();
		const organizationId = url.searchParams.get('organization') ?? '';
		const locationId = url.searchParams.get('location') ?? '';
		const activeValue = String(form.get('active') ?? '');

		if (activeValue !== '0' && activeValue !== '1') {
			return fail(400, { message: 'Choose whether the location should be active or inactive.' });
		}

		const env = cloudflareEnv as Env;
		const db = createDatabase(env.DB);
		const result = await db
			.update(locations)
			.set({ isActive: Number(activeValue), updatedAt: new Date().toISOString() })
			.where(
				and(
					eq(locations.id, locationId),
					eq(locations.organizationId, organizationId),
					exists(
						db
							.select({ userId: organizationMemberships.userId })
							.from(organizationMemberships)
							.where(
								and(
									eq(organizationMemberships.organizationId, locations.organizationId),
									eq(organizationMemberships.userId, locals.user.id),
									eq(organizationMemberships.role, 'admin'),
									eq(organizationMemberships.status, 'active')
								)
							)
					)
				)
			)
			.run();

		if (result.meta.changes !== 1) error(404, 'Location not found');

		return { success: `Location ${activeValue === '1' ? 'reactivated' : 'deactivated'}.` };
	},
	createService: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');

		const form = await request.formData();
		const organizationId = url.searchParams.get('organization') ?? '';
		const locationId = url.searchParams.get('location') ?? '';
		const name = String(form.get('serviceName') ?? '').trim();
		const description = String(form.get('serviceDescription') ?? '').trim();

		if (!name || name.length > 160 || description.length > 1000) {
			return fail(400, { message: 'Enter a service name up to 160 characters and a description up to 1,000 characters.' });
		}

		const db = createDatabase((cloudflareEnv as Env).DB);
		const now = new Date().toISOString();
		const result = await db.insert(services).select(db.select({
			id: sql<string>`${crypto.randomUUID()}`.as('id'),
			organizationId: sql<string>`${organizationId}`.as('organization_id'),
			locationId: locations.id,
			name: sql<string>`${name}`.as('name'),
			description: sql<string | null>`${description || null}`.as('description'),
			isActive: sql<number>`1`.as('is_active'),
			updatedAt: sql<string>`${now}`.as('updated_at')
		}).from(locations).where(and(
			eq(locations.id, locationId),
			eq(locations.organizationId, organizationId),
			exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
				eq(organizationMemberships.organizationId, locations.organizationId),
				eq(organizationMemberships.userId, locals.user.id),
				eq(organizationMemberships.role, 'admin'),
				eq(organizationMemberships.status, 'active')
			)))
		))).run();

		if (result.meta.changes !== 1) error(404, 'Location not found');

		return { success: `Service “${name}” created.` };
	},
	updateService: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');

		const form = await request.formData();
		const organizationId = url.searchParams.get('organization') ?? '';
		const serviceId = url.searchParams.get('service') ?? '';
		const name = String(form.get('serviceName') ?? '').trim();
		const description = String(form.get('serviceDescription') ?? '').trim();

		if (!name || name.length > 160 || description.length > 1000) {
			return fail(400, { message: 'Enter a service name up to 160 characters and a description up to 1,000 characters.' });
		}

		const db = createDatabase((cloudflareEnv as Env).DB);
		const result = await db.update(services).set({ name, description: description || null, updatedAt: new Date().toISOString() }).where(and(
			eq(services.id, serviceId),
			eq(services.organizationId, organizationId),
			exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
				eq(organizationMemberships.organizationId, services.organizationId),
				eq(organizationMemberships.userId, locals.user.id),
				eq(organizationMemberships.role, 'admin'),
				eq(organizationMemberships.status, 'active')
			)))
		)).run();

		if (result.meta.changes !== 1) error(404, 'Service not found');

		return { success: `Service “${name}” updated.` };
	},
	setServiceStatus: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');

		const form = await request.formData();
		const organizationId = url.searchParams.get('organization') ?? '';
		const serviceId = url.searchParams.get('service') ?? '';
		const activeValue = String(form.get('active') ?? '');

		if (activeValue !== '0' && activeValue !== '1') {
			return fail(400, { message: 'Choose whether the service should be active or inactive.' });
		}

		const db = createDatabase((cloudflareEnv as Env).DB);
		const result = await db.update(services).set({ isActive: Number(activeValue), updatedAt: new Date().toISOString() }).where(and(
			eq(services.id, serviceId),
			eq(services.organizationId, organizationId),
			exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
				eq(organizationMemberships.organizationId, services.organizationId),
				eq(organizationMemberships.userId, locals.user.id),
				eq(organizationMemberships.role, 'admin'),
				eq(organizationMemberships.status, 'active')
			)))
		)).run();

		if (result.meta.changes !== 1) error(404, 'Service not found');

		return { success: `Service ${activeValue === '1' ? 'reactivated' : 'deactivated'}.` };
	},
	signOut: async ({ request, url }) => {
		const env = cloudflareEnv as Env;
		const auth = createAuth(env.DB, url.origin, env.BETTER_AUTH_SECRET);
		await auth.api.signOut({ headers: request.headers });
		redirect(303, '/staff/sign-in');
	}
};
