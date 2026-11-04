import { env as cloudflareEnv } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, eq, or, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { getJoinState, joinVisitorQueue, findActiveBrowserTicket, findOrCreateTrackingCredential } from '#lib/server/visitor-join';
import { digestCredential, generateCredential, isValidCredential } from '#lib/server/visitor-credential';
import { validateVisitorIdentity } from '#lib/server/visitor-validation';
import { nextScheduledOccurrence } from '#lib/server/queue-scheduling';
import { locations, organizations, queueSchedules, queueSessions, queues, services, tickets } from '#lib/server/schema';

const duplicatePreventionEnabled = !(import.meta.env.DEV && (process.env.BROWSER_DUPLICATE_SIGNUP_PREVENTION ?? 'true') === 'false');
const browserCookie = 'kewkew_browser';

function applyPrivateHeaders(setHeaders: (headers: Record<string, string>) => void) {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'same-origin' });
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
		timezone: locations.timezone,
		queueIsActive: queues.isActive,
		locationIsActive: locations.isActive,
		serviceIsActive: services.isActive,
		sessionState: queueSessions.state,
		sessionId: queueSessions.id,
		occurrenceKey: queueSessions.occurrenceKey,
		signupOpensAt: queueSessions.signupOpensAt,
		scheduledServiceStartAt: queueSessions.scheduledServiceStartAt,
		occurrenceTicketCap: queueSessions.occurrenceTicketCap,
		occurrenceTicketCount: sql<number>`(
			SELECT COUNT(*) FROM tickets issued
			WHERE issued.queue_session_id = ${queueSessions.id}
		)`,
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
	const schedule = await db.select({
		enabled: queueSchedules.enabled,
		weekdays: queueSchedules.weekdays,
		signupOpenTime: queueSchedules.signupOpenTime,
		serviceStartTime: queueSchedules.serviceStartTime
	})
		.from(queueSchedules)
		.where(and(
			eq(queueSchedules.organizationId, queue.organizationId),
			eq(queueSchedules.queueId, queue.id),
			eq(queueSchedules.enabled, 1)
		))
		.get();
	const now = Date.now();
	let nextOccurrence: ReturnType<typeof nextScheduledOccurrence> = null;
	if (!queue.sessionId && schedule) {
		try {
			const weekdays: unknown = JSON.parse(schedule.weekdays);
			if (Array.isArray(weekdays) && weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
				nextOccurrence = nextScheduledOccurrence(now, queue.timezone, weekdays, schedule.signupOpenTime, schedule.serviceStartTime);
			}
		} catch {
			// Ignore malformed schedule data in the public view; it cannot be joined without an open session.
		}
	}
	const occurrenceKey = queue.occurrenceKey ?? nextOccurrence?.occurrenceKey ?? null;
	const signupOpensAt = queue.signupOpensAt ?? nextOccurrence?.signupOpensAt ?? null;
	const scheduledServiceStartAt = queue.scheduledServiceStartAt ?? nextOccurrence?.scheduledServiceStartAt ?? null;

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
			const existingTicket = await findActiveBrowserTicket(db, queue.publicId, await digestCredential(browserToken));
			if (existingTicket) {
				existingTicketToken = generateCredential();
				await findOrCreateTrackingCredential(db, existingTicket.id, await digestCredential(existingTicketToken));
				redirect(303, `/t/${existingTicketToken}`);
			}
		}
	}

	const atCapacity = queue.activeTicketCapacity !== null && queue.activeTicketCount >= queue.activeTicketCapacity;
	const occurrenceFull = queue.occurrenceTicketCap !== null && queue.occurrenceTicketCount >= queue.occurrenceTicketCap;
	const signupNotOpen = signupOpensAt !== null && Date.parse(signupOpensAt) > now;
	const signupAvailable = queue.queueIsActive === 1 && queue.locationIsActive === 1 && queue.serviceIsActive === 1 && queue.sessionState === 'open' && !atCapacity && !occurrenceFull && !signupNotOpen;
	const unavailableReason = signupAvailable ? null
		: atCapacity ? 'queue_full'
			: occurrenceFull ? 'occurrence_full'
			: queue.queueIsActive !== 1 ? 'queue_inactive'
				: queue.locationIsActive !== 1 ? 'location_inactive'
					: queue.serviceIsActive !== 1 ? 'service_inactive'
						: queue.sessionState === 'paused' ? 'session_paused'
							: signupNotOpen ? 'signup_not_open' : 'session_not_open';
	const serviceChoices = choices.map((choice) => ({
		publicId: choice.publicId,
		queueName: choice.queueName,
		serviceName: choice.serviceName,
		signupAvailable: choice.queueIsActive === 1 && choice.locationIsActive === 1 && choice.serviceIsActive === 1 && choice.sessionState === 'open' && (choice.capacity === null || choice.activeCount < choice.capacity)
	}));
	const attemptToken = generateCredential();
	return {
		queue: { publicId: queue.publicId, name: queue.name, organizationName: queue.organizationName, locationName: queue.locationName, serviceName: queue.serviceName, timezone: queue.timezone, occurrenceKey, signupOpensAt, scheduledServiceStartAt },
		signupNotOpen,
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
		const formError = (status: number, message: string, attemptToken: string, extra: {
			firstName?: string;
			lastName?: string;
			fieldErrors?: { firstName?: string; lastName?: string };
		} = {}) => fail(status, {
			joinMessage: message,
			attemptToken,
			firstName: extra.firstName ?? '',
			lastName: extra.lastName ?? '',
			fieldErrors: extra.fieldErrors ?? {}
		});
		const formData = await request.formData();
		const attemptToken = String(formData.get('attemptToken') ?? '');
		const occurrenceKeyInput = String(formData.get('expectedOccurrenceKey') ?? '');
		if (occurrenceKeyInput && !/^\d{4}-\d{2}-\d{2}$/.test(occurrenceKeyInput)) {
			return formError(400, 'Refresh this page and try again.', attemptToken || generateCredential());
		}
		if (!isValidCredential(attemptToken)) return formError(400, 'Refresh this page and try again.', generateCredential());
		const db = createDatabase((cloudflareEnv as Env).DB);
		const state = await getJoinState(db, params.publicId.toLowerCase());
		if (!state) return formError(404, 'This queue is no longer available.', attemptToken);
		const rawFirstName = String(formData.get('firstName') ?? '');
		const rawLastName = String(formData.get('lastName') ?? '');
		const identity = validateVisitorIdentity(state.identityPolicy, rawFirstName, rawLastName);
		if (!identity.valid) return formError(400, identity.message, attemptToken, {
			fieldErrors: identity.fieldErrors,
			firstName: rawFirstName,
			lastName: rawLastName
		});

		let browserToken: string | undefined;
		if (duplicatePreventionEnabled) {
			browserToken = cookies.get(browserCookie);
			if (!browserToken || !isValidCredential(browserToken)) browserToken = generateCredential();
		}
		const browserDigest = browserToken ? await digestCredential(browserToken) : undefined;
		const result = await joinVisitorQueue(db, {
			publicId: params.publicId.toLowerCase(), attemptToken,
			expectedOccurrenceKey: occurrenceKeyInput || null,
			browserDigest,
			firstName: identity.firstName ?? undefined,
			lastName: identity.lastName ?? undefined
		});
		if (result === 'created_or_replayed') {
			if (browserToken) cookies.set(browserCookie, browserToken, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 60 * 60 * 24 * 365 });
			redirect(303, `/t/${attemptToken}`);
		}
		if (result === 'browser_already_joined') {
			if (browserToken) cookies.set(browserCookie, browserToken, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 60 * 60 * 24 * 365 });
			const existing = browserDigest ? await findActiveBrowserTicket(db, params.publicId.toLowerCase(), browserDigest) : undefined;
			if (!existing) return formError(409, 'Your existing ticket could not be reopened. Use its saved tracking link.', attemptToken);
			await findOrCreateTrackingCredential(db, existing.id, await digestCredential(attemptToken));
			redirect(303, `/t/${attemptToken}`);
		}
		const messages = {
			name_required: 'Enter both your first and last name.',
			unavailable: 'This signup is no longer available. The scheduled occurrence may have closed. Refresh the page or check with staff.',
			full: 'This queue or scheduled occurrence is full. Please check with staff for your next step.',
			failed: 'We could not complete your signup. Refresh the page and try again.'
		};
		return formError(result === 'failed' ? 500 : 409, messages[result], attemptToken, { firstName: rawFirstName, lastName: rawLastName });
	}
};
