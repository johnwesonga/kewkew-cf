import { env as cloudflareEnv } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { and, eq, or } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { locations, organizations, queueSessions, queues, services } from '#lib/server/schema';

export const load: PageServerLoad = async ({ params }) => {
	if (!/^[0-9a-f]{32}$/i.test(params.publicId)) redirect(303, '/q/unavailable');

	const db = createDatabase((cloudflareEnv as Env).DB);
	const queue = await db.select({
		id: queues.id,
		publicId: queues.publicId,
		organizationId: queues.organizationId,
		locationId: queues.locationId,
		name: queues.name,
		organizationName: organizations.name,
		locationName: locations.name,
		serviceName: services.name,
		queueIsActive: queues.isActive,
		locationIsActive: locations.isActive,
		serviceIsActive: services.isActive,
		sessionState: queueSessions.state
	})
		.from(queues)
		.innerJoin(organizations, eq(organizations.id, queues.organizationId))
		.innerJoin(locations, and(
			eq(locations.organizationId, queues.organizationId),
			eq(locations.id, queues.locationId)
		))
		.innerJoin(services, and(
			eq(services.organizationId, queues.organizationId),
			eq(services.id, queues.serviceId),
			eq(services.locationId, queues.locationId)
		))
		.leftJoin(queueSessions, and(
			eq(queueSessions.organizationId, queues.organizationId),
			eq(queueSessions.queueId, queues.id),
			or(eq(queueSessions.state, 'open'), eq(queueSessions.state, 'paused'))
		))
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
		sessionState: queueSessions.state
	})
		.from(queues)
		.innerJoin(locations, and(
			eq(locations.organizationId, queues.organizationId),
			eq(locations.id, queues.locationId)
		))
		.innerJoin(services, and(
			eq(services.organizationId, queues.organizationId),
			eq(services.id, queues.serviceId),
			eq(services.locationId, queues.locationId)
		))
		.leftJoin(queueSessions, and(
			eq(queueSessions.organizationId, queues.organizationId),
			eq(queueSessions.queueId, queues.id),
			or(eq(queueSessions.state, 'open'), eq(queueSessions.state, 'paused'))
		))
		.where(and(
			eq(queues.organizationId, queue.organizationId),
			eq(queues.locationId, queue.locationId)
		))
		.orderBy(services.name, queues.name);

	const signupAvailable = queue.queueIsActive === 1
		&& queue.locationIsActive === 1
		&& queue.serviceIsActive === 1
		&& queue.sessionState === 'open';
	const unavailableReason = signupAvailable
		? null
		: queue.queueIsActive !== 1
			? 'queue_inactive'
			: queue.locationIsActive !== 1
				? 'location_inactive'
				: queue.serviceIsActive !== 1
					? 'service_inactive'
					: queue.sessionState === 'paused'
						? 'session_paused'
						: 'session_not_open';

	const serviceChoices = choices.map((choice) => ({
		publicId: choice.publicId,
		queueName: choice.queueName,
		serviceName: choice.serviceName,
		signupAvailable: choice.queueIsActive === 1
			&& choice.locationIsActive === 1
			&& choice.serviceIsActive === 1
			&& choice.sessionState === 'open'
	}));
	const publicQueue = {
		publicId: queue.publicId,
		name: queue.name,
		organizationName: queue.organizationName,
		locationName: queue.locationName,
		serviceName: queue.serviceName
	};

	return { queue: publicQueue, signupAvailable, unavailableReason, serviceChoices };
};
