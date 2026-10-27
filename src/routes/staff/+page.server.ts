import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env as cloudflareEnv } from 'cloudflare:workers';
import { createAuth } from '../../lib/server/auth';
import { createDatabase } from '../../lib/server/database';
import { and, asc, eq, exists, inArray, sql } from 'drizzle-orm';
import { locations, membershipLocationAccess, organizationMemberships, organizations, services } from '../../lib/server/schema';
import { isValidIanaTimezone } from '../../lib/timezones';

type Membership = {
	organizationId: string;
	organizationName: string;
	role: 'admin' | 'operator';
};

type Location = {
	id: string;
	name: string;
	timezone: string;
	isActive: number;
};

type Service = {
	id: string;
	locationId: string;
	name: string;
	description: string | null;
	isActive: number;
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
		? await env.DB.prepare(
			`SELECT l.id, l.name, l.timezone, l.is_active AS isActive
				 FROM locations AS l
				 WHERE l.organization_id = ?
				   AND EXISTS (
					 SELECT 1 FROM organization_memberships AS m
					 WHERE m.organization_id = l.organization_id
					   AND m.user_id = ? AND m.role = 'admin' AND m.status = 'active'
				   )
				 ORDER BY l.name COLLATE NOCASE, l.id`
		)
			.bind(organization.organizationId, locals.user.id)
			.all<Location>()
		: await env.DB.prepare(
			`SELECT l.id, l.name, l.timezone, l.is_active AS isActive
				 FROM membership_location_access AS a
				 JOIN locations AS l
				   ON l.organization_id = a.organization_id AND l.id = a.location_id
				 JOIN organization_memberships AS m
				   ON m.organization_id = a.organization_id AND m.user_id = a.user_id
				 WHERE a.organization_id = ? AND a.user_id = ?
				   AND m.role = 'operator' AND m.status = 'active'
				 ORDER BY l.name COLLATE NOCASE, l.id`
		)
			.bind(organization.organizationId, locals.user.id)
			.all<Location>();
	const servicesResult = organization.role === 'admin'
		? await env.DB.prepare(
			`SELECT s.id, s.location_id AS locationId, s.name, s.description,
				        s.is_active AS isActive
				 FROM services AS s
				 JOIN locations AS l
				   ON l.organization_id = s.organization_id AND l.id = s.location_id
				 WHERE s.organization_id = ?
				   AND EXISTS (
					 SELECT 1 FROM organization_memberships AS m
					 WHERE m.organization_id = s.organization_id
					   AND m.user_id = ? AND m.role = 'admin' AND m.status = 'active'
				   )
				 ORDER BY l.name COLLATE NOCASE, s.name COLLATE NOCASE, s.id`
		)
			.bind(organization.organizationId, locals.user.id)
			.all<Service>()
		: await env.DB.prepare(
			`SELECT s.id, s.location_id AS locationId, s.name, s.description,
				        s.is_active AS isActive
				 FROM membership_location_access AS a
				 JOIN locations AS l
				   ON l.organization_id = a.organization_id AND l.id = a.location_id
				 JOIN services AS s
				   ON s.organization_id = l.organization_id AND s.location_id = l.id
				 JOIN organization_memberships AS m
				   ON m.organization_id = a.organization_id AND m.user_id = a.user_id
				 WHERE a.organization_id = ? AND a.user_id = ?
				   AND m.role = 'operator' AND m.status = 'active'
				 ORDER BY l.name COLLATE NOCASE, s.name COLLATE NOCASE, s.id`
		)
			.bind(organization.organizationId, locals.user.id)
			.all<Service>();

	return {
		user: { name: locals.user.name, email: locals.user.email },
		organizations: memberships,
		organization,
		locations: locationsResult.results ?? [],
		services: servicesResult.results ?? []
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

		const env = cloudflareEnv as Env;
		const result = await env.DB.prepare(
			`INSERT INTO services (id, organization_id, location_id, name, description, is_active)
			 SELECT ?, ?, l.id, ?, ?, 1
			 FROM locations AS l
			 WHERE l.id = ? AND l.organization_id = ?
			   AND EXISTS (
				 SELECT 1 FROM organization_memberships AS m
				 WHERE m.organization_id = l.organization_id
				   AND m.user_id = ? AND m.role = 'admin' AND m.status = 'active'
			   )`
		).bind(
			crypto.randomUUID(),
			organizationId,
			name,
			description || null,
			locationId,
			organizationId,
			locals.user.id
		).run();

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

		const env = cloudflareEnv as Env;
		const result = await env.DB.prepare(
			`UPDATE services
			 SET name = ?, description = ?, updated_at = ?
			 WHERE id = ? AND organization_id = ?
			   AND EXISTS (
				 SELECT 1 FROM organization_memberships AS m
				 WHERE m.organization_id = services.organization_id
				   AND m.user_id = ? AND m.role = 'admin' AND m.status = 'active'
			   )`
		).bind(
			name,
			description || null,
			new Date().toISOString(),
			serviceId,
			organizationId,
			locals.user.id
		).run();

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

		const env = cloudflareEnv as Env;
		const result = await env.DB.prepare(
			`UPDATE services
			 SET is_active = ?, updated_at = ?
			 WHERE id = ? AND organization_id = ?
			   AND EXISTS (
				 SELECT 1 FROM organization_memberships AS m
				 WHERE m.organization_id = services.organization_id
				   AND m.user_id = ? AND m.role = 'admin' AND m.status = 'active'
			   )`
		).bind(
			Number(activeValue),
			new Date().toISOString(),
			serviceId,
			organizationId,
			locals.user.id
		).run();

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
