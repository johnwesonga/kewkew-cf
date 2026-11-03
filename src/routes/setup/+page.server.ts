import { env as cloudflareEnv } from 'cloudflare:workers';
import { constantTimeEqual, hashPassword } from 'better-auth/crypto';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import {
	accounts,
	installationSetup,
	locations,
	membershipAuditEvents,
	organizationMemberships,
	organizations,
	users
} from '#lib/server/schema';
import { canRunInitialSetup, validateInitialSetup } from '#lib/server/setup-validation';

export const load: PageServerLoad = async () => {
	const db = createDatabase((cloudflareEnv as Env).DB);
	const state = await db.select({ initializedAt: installationSetup.initializedAt })
		.from(installationSetup).where(eq(installationSetup.id, 1)).get();

	if (!canRunInitialSetup(state?.initializedAt)) redirect(303, '/staff/sign-in');

	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const env = cloudflareEnv as Env;
		const form = await request.formData();
		const bootstrapSecret = String(form.get('bootstrapSecret') ?? '');

		if (!env.KEWKEW_BOOTSTRAP_SECRET) {
			return fail(503, { message: 'Trusted setup is not configured.' });
		}

		if (!constantTimeEqual(bootstrapSecret, env.KEWKEW_BOOTSTRAP_SECRET)) {
			return fail(403, { message: 'The setup credential is invalid.' });
		}

		const validation = validateInitialSetup({
			organizationName: String(form.get('organizationName') ?? ''),
			locationName: String(form.get('locationName') ?? ''),
			timezone: String(form.get('timezone') ?? ''),
			adminName: String(form.get('adminName') ?? ''),
			email: String(form.get('email') ?? ''),
			password: String(form.get('password') ?? '')
		});
		if (!validation.valid) return fail(400, { message: validation.message });
		const { organizationName, locationName, timezone, adminName, email, password } = validation.value;

		const userId = crypto.randomUUID();
		const organizationId = crypto.randomUUID();
		const locationId = crypto.randomUUID();
		const accountId = crypto.randomUUID();
		const passwordHash = await hashPassword(password);
		const now = new Date().toISOString();
		const db = createDatabase(env.DB);
		const setupPending = and(eq(installationSetup.id, 1), isNull(installationSetup.initializedAt));

		// Each insert selects from the singleton setup row only while setup is pending.
		// The final marker update is in the same D1 batch, keeping bootstrap one-time.
		const createOrg = db.insert(organizations).select(db.select({
			id: sql<string>`${organizationId}`.as('id'),
			name: sql<string>`${organizationName}`.as('name'),
			updatedAt: sql<string>`${now}`.as('updated_at')
		}).from(installationSetup).where(setupPending));
		const createLocation = db.insert(locations).select(db.select({
			id: sql<string>`${locationId}`.as('id'),
			organizationId: sql<string>`${organizationId}`.as('organization_id'),
			name: sql<string>`${locationName}`.as('name'),
			timezone: sql<string>`${timezone}`.as('timezone'),
			isActive: sql<number>`1`.as('is_active'),
			updatedAt: sql<string>`${now}`.as('updated_at')
		}).from(installationSetup).where(setupPending));
		const createUser = db.insert(users).select(db.select({
			id: sql<string>`${userId}`.as('id'),
			name: sql<string>`${adminName}`.as('name'),
			email: sql<string>`${email}`.as('email'),
			emailVerified: sql<number>`0`.as('email_verified'),
			createdAt: sql<string>`${now}`.as('created_at'),
			updatedAt: sql<string>`${now}`.as('updated_at')
		}).from(installationSetup).where(setupPending));
		const createAccount = db.insert(accounts).select(db.select({
			id: sql<string>`${accountId}`.as('id'),
			accountId: sql<string>`${userId}`.as('account_id'),
			providerId: sql<string>`'credential'`.as('provider_id'),
			userId: sql<string>`${userId}`.as('user_id'),
			password: sql<string>`${passwordHash}`.as('password'),
			createdAt: sql<string>`${now}`.as('created_at'),
			updatedAt: sql<string>`${now}`.as('updated_at')
		}).from(installationSetup).where(setupPending));
		const createMembership = db.insert(organizationMemberships).select(db.select({
			organizationId: sql<string>`${organizationId}`.as('organization_id'),
			userId: sql<string>`${userId}`.as('user_id'),
			role: sql<'admin'>`'admin'`.as('role'),
			status: sql<'active'>`'active'`.as('status'),
			createdAt: sql<string>`${now}`.as('created_at'),
			updatedAt: sql<string>`${now}`.as('updated_at')
		}).from(installationSetup).where(setupPending));
		const recordBootstrap = db.insert(membershipAuditEvents).select(db.select({
			id: sql<string>`${crypto.randomUUID()}`.as('id'),
			organizationId: sql<string>`${organizationId}`.as('organization_id'),
			actorUserId: sql<string>`${userId}`.as('actor_user_id'),
			subjectUserId: sql<string>`${userId}`.as('subject_user_id'),
			changeType: sql<'membership_created'>`'membership_created'`.as('change_type'),
			beforeRole: sql<null>`NULL`.as('before_role'),
			afterRole: sql<'admin'>`'admin'`.as('after_role'),
			beforeStatus: sql<null>`NULL`.as('before_status'),
			afterStatus: sql<'active'>`'active'`.as('after_status'),
			detailsJson: sql<null>`NULL`.as('details_json'),
			createdAt: sql<string>`${now}`.as('created_at')
		}).from(installationSetup).where(setupPending));
		const finishSetup = db.update(installationSetup).set({ initializedAt: now, organizationId })
			.where(setupPending);

		try {
			const results = await db.batch([
				createOrg,
				createLocation,
				createUser,
				createAccount,
				createMembership,
				recordBootstrap,
				finishSetup
			]);
			if (results[0]?.meta.changes !== 1 || results[6]?.meta.changes !== 1) {
				return fail(409, { message: 'This installation has already been initialized.' });
			}
		} catch {
			return fail(400, { message: 'Setup could not be completed. Check the details and try again.' });
		}

		redirect(303, '/staff/sign-in');
	}
};
