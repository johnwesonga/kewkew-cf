import { getRequestEvent } from '$app/server';
import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';

export function createAuth(database: D1Database, baseURL: string, secret: string) {
	return betterAuth({
		baseURL,
		secret,
		database,
		trustedOrigins: [baseURL],
		user: {
			modelName: 'users',
			fields: {
				emailVerified: 'email_verified',
				createdAt: 'created_at',
				updatedAt: 'updated_at'
			}
		},
		session: {
			modelName: 'sessions',
			fields: {
				userId: 'user_id',
				expiresAt: 'expires_at',
				createdAt: 'created_at',
				updatedAt: 'updated_at',
				ipAddress: 'ip_address',
				userAgent: 'user_agent'
			}
		},
		account: {
			modelName: 'accounts',
			fields: {
				accountId: 'account_id',
				providerId: 'provider_id',
				userId: 'user_id',
				accessToken: 'access_token',
				refreshToken: 'refresh_token',
				idToken: 'id_token',
				accessTokenExpiresAt: 'access_token_expires_at',
				refreshTokenExpiresAt: 'refresh_token_expires_at',
				createdAt: 'created_at',
				updatedAt: 'updated_at'
			}
		},
		verification: {
			modelName: 'verifications',
			fields: {
				expiresAt: 'expires_at',
				createdAt: 'created_at',
				updatedAt: 'updated_at'
			}
		},
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
			requireEmailVerification: false
		},
		rateLimit: {
			enabled: true,
			window: 60,
			max: 100,
			storage: 'database',
			modelName: 'rate_limits',
			customRules: {
				'/sign-in/email': { window: 300, max: 10 }
			},
			fields: {
				lastRequest: 'last_request'
			}
		},
		advanced: {
			database: {
				generateId: () => crypto.randomUUID()
			}
		},
		plugins: [sveltekitCookies(getRequestEvent)]
	});
}
