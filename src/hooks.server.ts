import { building } from '$app/env';
import { env as cloudflareEnv } from 'cloudflare:workers';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { createAuth } from './lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const env = cloudflareEnv as Env;
	const auth = createAuth(env.DB, event.url.origin, env.BETTER_AUTH_SECRET);
	const current = await auth.api.getSession({ headers: event.request.headers });

	event.locals.user = current?.user ?? null;
	event.locals.session = current?.session ?? null;

	return svelteKitHandler({ event, resolve, auth, building });
};
