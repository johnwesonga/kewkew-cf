import { env as cloudflareEnv } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { digestCredential, getTicketByTrackingCredential, isValidCredential } from '#lib/server/visitor-join';
import { organizations, queues, tickets } from '#lib/server/schema';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	if (!isValidCredential(params.token)) redirect(303, '/t/unavailable');
	const db = createDatabase((cloudflareEnv as Env).DB);
	const ticket = await getTicketByTrackingCredential(db, await digestCredential(params.token));
	if (!ticket) redirect(303, '/t/unavailable');
	const queueContext = await db.select({ organizationName: organizations.name, publicId: queues.publicId })
		.from(tickets)
		.innerJoin(queues, eq(queues.id, tickets.queueId))
		.innerJoin(organizations, eq(organizations.id, tickets.organizationId))
		.where(eq(tickets.id, ticket.id))
		.get();
	return {
		ticket: {
			number: ticket.ticketNumber,
			status: ticket.status,
			position: ['waiting', 'called', 'serving'].includes(ticket.status) ? ticket.position : null,
			queueName: ticket.queueName,
			organizationName: queueContext?.organizationName ?? 'Queue',
			serviceName: ticket.serviceName,
			locationName: ticket.locationName
			}
	};
};
