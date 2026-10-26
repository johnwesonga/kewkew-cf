import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env as cloudflareEnv } from 'cloudflare:workers';
import { createAuth } from '../../lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/staff/sign-in');
	return { user: { name: locals.user.name, email: locals.user.email } };
};

export const actions: Actions = {
	signOut: async ({ request, url }) => {
		const env = cloudflareEnv as Env;
		const auth = createAuth(env.DB, url.origin, env.BETTER_AUTH_SECRET);
		await auth.api.signOut({ headers: request.headers });
		redirect(303, '/staff/sign-in');
	}
};
