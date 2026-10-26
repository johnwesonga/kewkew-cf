import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env as cloudflareEnv } from 'cloudflare:workers';
import { createAuth } from '../../lib/server/auth';

type Membership = {
	organizationId: string;
	organizationName: string;
	role: 'admin' | 'operator';
};

type Location = {
	name: string;
	timezone: string;
	isActive: number;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, '/staff/sign-in');

	const env = cloudflareEnv as Env;
	const membershipsResult = await env.DB.prepare(
		`SELECT o.id AS organizationId, o.name AS organizationName, m.role
		 FROM organization_memberships AS m
		 JOIN organizations AS o ON o.id = m.organization_id
		 WHERE m.user_id = ? AND m.status = 'active'
		 ORDER BY o.name COLLATE NOCASE, o.id`
	).bind(locals.user.id).all<Membership>();
	const memberships = membershipsResult.results ?? [];

	if (memberships.length === 0) {
		return {
			user: { name: locals.user.name, email: locals.user.email },
			organizations: [],
			organization: null,
			locations: []
		};
	}

	const requestedOrganizationId = url.searchParams.get('organization');
	const organization = requestedOrganizationId
		? memberships.find((membership) => membership.organizationId === requestedOrganizationId)
		: memberships[0];

	if (!organization) error(404, 'Workspace not found');

	const locationsResult = organization.role === 'admin'
		? await env.DB.prepare(
				`SELECT l.name, l.timezone, l.is_active AS isActive
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
				`SELECT l.name, l.timezone, l.is_active AS isActive
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

	return {
		user: { name: locals.user.name, email: locals.user.email },
		organizations: memberships,
		organization,
		locations: locationsResult.results ?? []
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
		const result = await env.DB.prepare(
			`UPDATE organizations
			 SET name = ?, updated_at = ?
			 WHERE id = ?
			   AND EXISTS (
				 SELECT 1 FROM organization_memberships AS m
				 WHERE m.organization_id = organizations.id
				   AND m.user_id = ? AND m.role = 'admin' AND m.status = 'active'
			   )`
		).bind(name, new Date().toISOString(), organizationId, locals.user.id).run();

		if (result.meta.changes !== 1) error(404, 'Workspace not found');

		return { success: 'Organization name updated.' };
	},
	signOut: async ({ request, url }) => {
		const env = cloudflareEnv as Env;
		const auth = createAuth(env.DB, url.origin, env.BETTER_AUTH_SECRET);
		await auth.api.signOut({ headers: request.headers });
		redirect(303, '/staff/sign-in');
	}
};
