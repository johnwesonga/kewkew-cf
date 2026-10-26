import { env as cloudflareEnv } from 'cloudflare:workers';
import { constantTimeEqual, hashPassword } from 'better-auth/crypto';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supportedTimezones } from '../../lib/timezones';

export const load: PageServerLoad = async () => {
	const env = cloudflareEnv as Env;
	const state = await env.DB.prepare(
		' SELECT initialized_at FROM installation_setup WHERE id = 1'
	).first<{ initialized_at: string | null }>();

	if (!state || state.initialized_at) redirect(303, '/staff/sign-in');

	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const env = cloudflareEnv as Env;
		const form = await request.formData();
		const bootstrapSecret = String(form.get('bootstrapSecret') ?? '');
		const organizationName = String(form.get('organizationName') ?? '').trim();
		const locationName = String(form.get('locationName') ?? '').trim();
		const timezone = String(form.get('timezone') ?? '').trim();
		const adminName = String(form.get('adminName') ?? '').trim();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');

		if (!env.KEWKEW_BOOTSTRAP_SECRET) {
			return fail(503, { message: 'Trusted setup is not configured.' });
		}

		if (!constantTimeEqual(bootstrapSecret, env.KEWKEW_BOOTSTRAP_SECRET)) {
			return fail(403, { message: 'The setup credential is invalid.' });
		}

		if (
			!organizationName || organizationName.length > 160 ||
			!locationName || locationName.length > 160 ||
			!adminName || adminName.length > 160 ||
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ||
			password.length < 8 || password.length > 128
		) {
			return fail(400, { message: 'Enter valid organization, location, and administrator details.' });
		}

		if (!supportedTimezones.includes(timezone as (typeof supportedTimezones)[number])) {
			return fail(400, { message: 'Select a supported location timezone.' });
		}

		const userId = crypto.randomUUID();
		const organizationId = crypto.randomUUID();
		const locationId = crypto.randomUUID();
		const accountId = crypto.randomUUID();
		const passwordHash = await hashPassword(password);
		const now = new Date().toISOString();
		const createOrg = env.DB.prepare(
			`INSERT INTO organizations (id, name)
			 SELECT ?, ? WHERE EXISTS (
				SELECT 1 FROM installation_setup WHERE id = 1 AND initialized_at IS NULL
			 )`
		).bind(organizationId, organizationName);
		const createLocation = env.DB.prepare(
			`INSERT INTO locations (id, organization_id, name, timezone)
			 SELECT ?, ?, ?, ? WHERE EXISTS (
				SELECT 1 FROM installation_setup WHERE id = 1 AND initialized_at IS NULL
			 )`
		).bind(locationId, organizationId, locationName, timezone);
		const createUser = env.DB.prepare(
			`INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
			 SELECT ?, ?, ?, 0, ?, ? WHERE EXISTS (
				SELECT 1 FROM installation_setup WHERE id = 1 AND initialized_at IS NULL
			 )`
		).bind(userId, adminName, email, now, now);
		const createAccount = env.DB.prepare(
			`INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
			 SELECT ?, ?, 'credential', ?, ?, ?, ? WHERE EXISTS (
				SELECT 1 FROM installation_setup WHERE id = 1 AND initialized_at IS NULL
			 )`
		).bind(accountId, userId, userId, passwordHash, now, now);
		const createMembership = env.DB.prepare(
			`INSERT INTO organization_memberships (organization_id, user_id, role, status)
			 SELECT ?, ?, 'admin', 'active' WHERE EXISTS (
				SELECT 1 FROM installation_setup WHERE id = 1 AND initialized_at IS NULL
			 )`
		).bind(organizationId, userId);
		const recordBootstrap = env.DB.prepare(
			`INSERT INTO membership_audit_events (
				id, organization_id, actor_user_id, subject_user_id, change_type,
				after_role, after_status
			)
			 SELECT ?, ?, ?, ?, 'membership_created', 'admin', 'active'
			 WHERE EXISTS (
				SELECT 1 FROM installation_setup WHERE id = 1 AND initialized_at IS NULL
			 )`
		).bind(crypto.randomUUID(), organizationId, userId, userId);
		const finishSetup = env.DB.prepare(
			`UPDATE installation_setup
			 SET initialized_at = ?, organization_id = ?
			 WHERE id = 1 AND initialized_at IS NULL`
		).bind(now, organizationId);

		try {
			const results = await env.DB.batch([
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
