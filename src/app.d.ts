// See https://svelte.dev/docs/kit/types#app.d.ts for information about these interfaces.
import type { createAuth } from '#lib/server/auth';

type StaffSession = ReturnType<typeof createAuth>['$Infer']['Session'];

declare global {
	interface Env {
		BETTER_AUTH_SECRET: string;
		KEWKEW_BOOTSTRAP_SECRET: string;
		RESEND_API_KEY?: string;
		INVITATION_FROM_EMAIL?: string;
		PUBLIC_APP_URL?: string;
	}

	namespace App {
		interface Locals {
			user: StaffSession['user'] | null;
			session: StaffSession['session'] | null;
		}
	}
}

export {};
