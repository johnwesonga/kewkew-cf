import { env as cloudflareEnv } from 'cloudflare:workers';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, count, eq } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { locations, organizationMemberships, organizations, queueSchedules, queues } from '#lib/server/schema';
import { validateQueueSchedule } from '#lib/server/queue-scheduling';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, '/staff/sign-in');
	const db = createDatabase((cloudflareEnv as Env).DB);
	// Load the queue's location timezone with its optional schedule so form times
	// are always interpreted in the location's timezone.
	const result = await db
		.select({
			organizationId: queues.organizationId,
			queueName: queues.name,
			timezone: locations.timezone,
			id: queueSchedules.id,
			enabled: queueSchedules.enabled,
			weekdays: queueSchedules.weekdays,
			signupOpenTime: queueSchedules.signupOpenTime,
			serviceStartTime: queueSchedules.serviceStartTime,
			occurrenceTicketCap: queueSchedules.occurrenceTicketCap,
			version: queueSchedules.version
		})
		.from(queues)
		.innerJoin(locations, and(eq(locations.id, queues.locationId), eq(locations.organizationId, queues.organizationId)))
		.leftJoin(queueSchedules, and(eq(queueSchedules.queueId, queues.id), eq(queueSchedules.organizationId, queues.organizationId)))
		.where(eq(queues.id, params.queueId)).get();
	if (!result) error(404, 'Queue not found');
	// Schedule configuration is organization-admin-only; verify active membership
	// before returning any schedule details to the browser.
	const admin = await db
		.select({
			userId: organizationMemberships.userId
		})
		.from(organizationMemberships)
		.where(and(eq(organizationMemberships.organizationId, result.organizationId), eq(organizationMemberships.userId, locals.user.id),
			eq(organizationMemberships.role, 'admin'), eq(organizationMemberships.status, 'active'))).get();
	if (!admin) error(403, 'Administrator access required');
	// These values are used by the shared workspace shell around the form.
	const [workspace, locationCount] = await Promise.all([
		db.
			select({ name: organizations.name })
			.from(organizations)
			.where(eq(organizations.id, result.organizationId))
			.get(),
		db
			.select({ value: count() })
			.from(locations)
			.where(eq(locations.organizationId, result.organizationId))
			.get()
	]);
	return {
		...result,
		weekdays: result.weekdays ? JSON.parse(result.weekdays) as number[] : [],
		organizationId: result.organizationId,
		organizationName: workspace?.name ?? '',
		locationCount: locationCount?.value ?? 0,
		user: {
			name: locals.user.name,
			email: locals.user.email
		},
		saved: url.searchParams.get('saved') === '1'
	};
};

export const actions: Actions = {
	save: async ({ locals, params, request }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');
		const form = await request.formData();
		const db = createDatabase((cloudflareEnv as Env).DB);
		// Read the timezone from the queue's location rather than trusting a
		// timezone supplied by the client.
		const queue = await db
			.select({
				organizationId: queues.organizationId,
				timezone: locations.timezone
			})
			.from(queues)
			.innerJoin(locations, and(eq(locations.id, queues.locationId), eq(locations.organizationId, queues.organizationId)))
			.where(eq(queues.id, params.queueId))
			.get();
		if (!queue) error(404, 'Queue not found');
		// Recheck authorization for every mutation; page-load authorization alone
		// does not protect a forged or stale form submission.
		const admin = await db
			.select({ userId: organizationMemberships.userId })
			.from(organizationMemberships)
			.where(and(eq(organizationMemberships.organizationId, queue.organizationId), eq(organizationMemberships.userId, locals.user.id),
				eq(organizationMemberships.role, 'admin'), eq(organizationMemberships.status, 'active'))).get();
		if (!admin) error(403, 'Administrator access required');
		// Validate weekdays, local times, timezone, ordering, and optional cap
		// together so invalid input never reaches the database.
		const result = validateQueueSchedule({
			weekdays: form.getAll('weekday').map(Number),
			signupOpenTime: String(form.get('signupOpenTime') ?? ''),
			serviceStartTime: String(form.get('serviceStartTime') ?? ''),
			occurrenceTicketCap: String(form.get('occurrenceTicketCap') ?? ''),
			timezone: queue.timezone
		});
		if (!result.valid) return fail(400, { message: result.message });
		// Increment the version on edits so newly created occurrences can record
		// which template they used; existing sessions keep their saved timestamps.
		const existing = await db
			.select({
				id: queueSchedules.id,
				version: queueSchedules.version
			})
			.from(queueSchedules)
			.where(eq(queueSchedules.queueId, params.queueId)).get();
		const now = new Date().toISOString();
		if (existing) {
			await db
				.update(queueSchedules)
				.set({
					enabled: form.get('enabled') === 'on' ? 1 : 0,
					weekdays: JSON.stringify(result.value.weekdays),
					signupOpenTime: result.value.signupOpenTime,
					serviceStartTime: result.value.serviceStartTime,
					occurrenceTicketCap: result.value.occurrenceTicketCap,
					version: existing.version + 1,
					updatedAt: now
				})
				.where(eq(queueSchedules.id, existing.id))
				.run();
		} else {
			await db
				.insert(queueSchedules)
				.values({
					id: crypto.randomUUID(),
					organizationId: queue.organizationId,
					queueId: params.queueId,
					enabled: form.get('enabled') === 'on' ? 1 : 0,
					weekdays: JSON.stringify(result.value.weekdays),
					signupOpenTime: result.value.signupOpenTime,
					serviceStartTime: result.value.serviceStartTime,
					occurrenceTicketCap: result.value.occurrenceTicketCap,
					version: 1,
					updatedAt: now
				})
				.run();
		}
		redirect(303, `/staff/queues/${encodeURIComponent(params.queueId)}/schedule?saved=1`);
	}
};
