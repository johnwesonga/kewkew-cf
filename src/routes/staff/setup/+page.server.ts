import { env as cloudflareEnv } from 'cloudflare:workers';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { locations, organizationMemberships, organizations, services } from '#lib/server/schema';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, '/staff/sign-in');
	const db = createDatabase((cloudflareEnv as Env).DB);
	const organizationsForAdmin = await db.select({ id: organizations.id, name: organizations.name })
		.from(organizations)
		.innerJoin(organizationMemberships, eq(organizationMemberships.organizationId, organizations.id))
		.where(and(
			eq(organizationMemberships.userId, locals.user.id),
			eq(organizationMemberships.role, 'admin'),
			eq(organizationMemberships.status, 'active')
		))
		.orderBy(asc(sql`lower(${organizations.name})`), asc(organizations.id));
	if (!organizationsForAdmin.length) error(404, 'Setup is available to active organization administrators only.');
	const requestedOrganizationId = url.searchParams.get('organization');
	const organization = organizationsForAdmin.find((entry) => entry.id === requestedOrganizationId) ?? organizationsForAdmin[0]!;
	const [locationCount, serviceCount, memberCount] = await Promise.all([
		db.select({ value: count() }).from(locations).where(eq(locations.organizationId, organization.id)),
		db.select({ value: count() }).from(services).where(eq(services.organizationId, organization.id)),
		db.select({ value: count() }).from(organizationMemberships).where(eq(organizationMemberships.organizationId, organization.id))
	]);
	return {
		organization,
		organizations: organizationsForAdmin,
		locationCount: locationCount[0]?.value ?? 0,
		serviceCount: serviceCount[0]?.value ?? 0,
		memberCount: memberCount[0]?.value ?? 0
	};
};
