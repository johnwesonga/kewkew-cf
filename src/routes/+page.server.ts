import type { PageServerLoad } from './$types';
import { env } from 'cloudflare:workers';

export const load: PageServerLoad = async () => {
	const result = await (env as Env).DB.prepare(
		"SELECT value FROM app_meta WHERE key = 'schema_version'"
	).first<{ value: string }>();

	return {
		databaseReady: result !== null,
		schemaVersion: result?.value ?? null
	};
};
