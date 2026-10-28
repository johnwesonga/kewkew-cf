import { env as cloudflareEnv } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createAuth } from '#lib/server/auth';

export const actions: Actions = {
	default: async ({ request, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');

		if (!email || !password) return fail(400, { message: 'Enter your email and password.' });

		const env = cloudflareEnv as Env;
		const auth = createAuth(env.DB, url.origin, env.BETTER_AUTH_SECRET);
		try {
			await auth.api.signInEmail({
				body: { email, password },
				headers: request.headers
			});
		} catch {
			return fail(400, { message: 'The email or password is incorrect.' });
		}

		redirect(303, '/staff');
	}
};
