import { env as cloudflareEnv } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { and, eq } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { locations, organizations, queueSessions, queues, services } from '#lib/server/schema';

export const load: PageServerLoad = async ({ params }) => {
	if (!/^[0-9a-f]{32}$/i.test(params.publicId)) redirect(303, '/q/unavailable');

	const db = createDatabase((cloudflareEnv as Env).DB);
	const queue = await db.select({
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
			eq(queueSessions.state, 'open')
		))
		.where(eq(queues.publicId, params.publicId.toLowerCase()))
		.get();

	if (!queue) redirect(303, '/q/unavailable');
	const signupAvailable = queue.queueIsActive === 1
		&& queue.locationIsActive === 1
		&& queue.serviceIsActive === 1
		&& queue.sessionState === 'open';

	return { queue, signupAvailable };
};
