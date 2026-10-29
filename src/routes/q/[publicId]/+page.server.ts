import { env as cloudflareEnv } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, eq, or, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { findTrackedCredentialForBrowserTicket, generateCredential, getJoinState, joinAnonymousQueue, isValidCredential, digestCredential, findActiveBrowserTicket, findOrCreateTrackingCredential } from '#lib/server/visitor-join';
import { locations, organizations, queueSessions, queues, services, tickets } from '#lib/server/schema';

const duplicatePreventionEnabled = !(import.meta.env.DEV && (process.env.BROWSER_DUPLICATE_SIGNUP_PREVENTION ?? 'true') === 'false');
const browserCookie = 'kewkew_browser';

function applyPrivateHeaders(setHeaders: (headers: Record<string, string>) => void) {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
}

export const load: PageServerLoad = async ({ params, cookies, setHeaders }) => {
	applyPrivateHeaders(setHeaders);
	if (!/^[0-9a-f]{32}$/i.test(params.publicId)) redirect(303, '/q/unavailable');

	const db = createDatabase((cloudflareEnv as Env).DB);
	const queue = await db.select({
		id: queues.id,
		publicId: queues.publicId,
		organizationId: queues.organizationId,
		locationId: queues.locationId,
		name: queues.name,
		identityPolicy: queues.identityPolicy,
		activeTicketCapacity: queues.activeTicketCapacity,
		organizationName: organizations.name,
		locationName: locations.name,
		serviceName: services.name,
		queueIsActive: queues.isActive,
		locationIsActive: locations.isActive,
		serviceIsActive: services.isActive,
		sessionState: queueSessions.state,
		sessionId: queueSessions.id,
		activeTicketCount: sql<number>`(
			SELECT COUNT(*) FROM tickets
			WHERE tickets.queue_session_id = ${queueSessions.id}
			AND tickets.status IN ('waiting', 'called', 'serving')
		)`
	})
		.from(queues)
		.innerJoin(organizations, eq(organizations.id, queues.organizationId))
		.innerJoin(locations, and(eq(locations.organizationId, queues.organizationId), eq(locations.id, queues.locationId)))
		.innerJoin(services, and(eq(services.organizationId, queues.organizationId), eq(services.id, queues.serviceId), eq(services.locationId, queues.locationId)))
		.leftJoin(queueSessions, and(eq(queueSessions.organizationId, queues.organizationId), eq(queueSessions.queueId, queues.id), or(eq(queueSessions.state, 'open'), eq(queueSessions.state, 'paused'))))
		.where(eq(queues.publicId, params.publicId.toLowerCase()))
		.get();
	if (!queue) redirect(303, '/q/unavailable');

	const choices = await db.select({
		publicId: queues.publicId,
		queueName: queues.name,
		serviceName: services.name,
		queueIsActive: queues.isActive,
		locationIsActive: locations.isActive,
		serviceIsActive: services.isActive,
		sessionState: queueSessions.state,
		capacity: queues.activeTicketCapacity,
		activeCount: sql<number>`(
			SELECT COUNT(*) FROM tickets
			WHERE tickets.queue_session_id = ${queueSessions.id}
			AND tickets.status IN ('waiting', 'called', 'serving')
		)`
	})
		.from(queues)
		.innerJoin(locations, and(eq(locations.organizationId, queues.organizationId), eq(locations.id, queues.locationId)))
		.innerJoin(services, and(eq(services.organizationId, queues.organizationId), eq(services.id, queues.serviceId), eq(services.locationId, queues.locationId)))
		.leftJoin(queueSessions, and(eq(queueSessions.organizationId, queues.organizationId), eq(queueSessions.queueId, queues.id), or(eq(queueSessions.state, 'open'), eq(queueSessions.state, 'paused'))))
		.where(and(eq(queues.organizationId, queue.organizationId), eq(queues.locationId, queue.locationId)))
		.orderBy(services.name, queues.name);

	let existingTicketToken: string | undefined;
	if (duplicatePreventionEnabled && queue.sessionId) {
		const browserToken = cookies.get(browserCookie);
		if (browserToken && isValidCredential(browserToken)) {
			existingTicketToken = await findTrackedCredentialForBrowserTicket(db, queue.publicId, await digestCredential(browserToken));
			if (existingTicketToken) redirect(303, `/t/${existingTicketToken}`);
		}
	}

	const atCapacity = queue.activeTicketCapacity !== null && queue.activeTicketCount >= queue.activeTicketCapacity;
	const signupAvailable = queue.queueIsActive === 1 && queue.locationIsActive === 1 && queue.serviceIsActive === 1 && queue.sessionState === 'open' && !atCapacity;
	const unavailableReason = signupAvailable ? null
		: atCapacity ? 'queue_full'
			: queue.queueIsActive !== 1 ? 'queue_inactive'
				: queue.locationIsActive !== 1 ? 'location_inactive'
					: queue.serviceIsActive !== 1 ? 'service_inactive'
						: queue.sessionState === 'paused' ? 'session_paused' : 'session_not_open';
	const serviceChoices = choices.map((choice) => ({
		publicId: choice.publicId,
		queueName: choice.queueName,
		serviceName: choice.serviceName,
		signupAvailable: choice.queueIsActive === 1 && choice.locationIsActive === 1 && choice.serviceIsActive === 1 && choice.sessionState === 'open' && (choice.capacity === null || choice.activeCount < choice.capacity)
	}));
	const attemptToken = generateCredential();
	return {
		queue: { publicId: queue.publicId, name: queue.name, organizationName: queue.organizationName, locationName: queue.locationName, serviceName: queue.serviceName },
		identityPolicy: queue.identityPolicy,
		signupAvailable,
		unavailableReason,
		serviceChoices,
		attemptToken,
		existingTicketToken
	};
};

export const actions: Actions = {
	join: async ({ params, request, cookies, url }) => {
		const formData = await request.formData();
		const attemptToken = String(formData.get('attemptToken') ?? '');
		if (!isValidCredential(attemptToken)) return fail(400, { joinMessage: 'Refresh this page and try again.', attemptToken: generateCredential() });
		const db = createDatabase((cloudflareEnv as Env).DB);
		const state = await getJoinState(db, params.publicId.toLowerCase());
		if (!state) return fail(404, { joinMessage: 'This queue is no longer available.', attemptToken });
		if (state.identityPolicy !== 'anonymous') return fail(400, { joinMessage: 'This queue requires first and last name. Please ask staff to assist.', attemptToken });

		let browserToken: string | undefined;
		if (duplicatePreventionEnabled) {
			browserToken = cookies.get(browserCookie);
			if (!browserToken || !isValidCredential(browserToken)) browserToken = generateCredential();
		}
		const browserDigest = browserToken ? await digestCredential(browserToken) : undefined;
		const result = await joinAnonymousQueue(db, { publicId: params.publicId.toLowerCase(), attemptToken, browserDigest });
		if (result === 'created_or_replayed') {
			if (browserToken) cookies.set(browserCookie, browserToken, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 60 * 60 * 24 * 365 });
			redirect(303, `/t/${attemptToken}`);
		}
		if (result === 'browser_already_joined') {
			if (browserToken) cookies.set(browserCookie, browserToken, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 60 * 60 * 24 * 365 });
			const existing = browserDigest ? await findActiveBrowserTicket(db, params.publicId.toLowerCase(), browserDigest) : undefined;
			if (!existing) return fail(409, { joinMessage: 'Your existing ticket could not be reopened. Use its saved tracking link.', attemptToken });
			await findOrCreateTrackingCredential(db, existing.id, await digestCredential(attemptToken));
			redirect(303, `/t/${attemptToken}`);
		}
		const messages = {
			name_required: 'This queue requires first and last name. Please ask staff to assist.',
			unavailable: 'This queue is no longer accepting visitors. Please check with staff.',
			full: 'This queue has reached capacity. Please check with staff for your next step.',
			failed: 'We could not complete your signup. Refresh the page and try again.'
		};
		return fail(result === 'failed' ? 500 : 409, { joinMessage: messages[result], attemptToken });
	}
};
