import { env as cloudflareEnv } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { cancelTrackedTicket, getTicketByTrackingCredential } from '#lib/server/visitor-join';
import { digestCredential, isValidCredential } from '#lib/server/visitor-credential';
import { organizations, tickets } from '#lib/server/schema';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	if (!isValidCredential(params.token)) redirect(303, '/t/unavailable');
	const db = createDatabase((cloudflareEnv as Env).DB);
	const ticket = await getTicketByTrackingCredential(db, await digestCredential(params.token));
	if (!ticket) redirect(303, '/t/unavailable');
	const queueContext = await db.select({ organizationName: organizations.name })
		.from(tickets)
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

export const actions: Actions = {
	cancel: async ({ params, request }) => {
		if (!isValidCredential(params.token)) redirect(303, '/t/unavailable');
		const form = await request.formData();
		if (form.get('confirmCancellation') !== 'yes') {
			return fail(400, { cancelMessage: 'Confirm that you want to leave this queue.' });
		}
		const db = createDatabase((cloudflareEnv as Env).DB);
		const result = await cancelTrackedTicket(db, await digestCredential(params.token));
		if (result === 'unavailable') redirect(303, '/t/unavailable');
		if (result === 'not_waiting') {
			return fail(409, { cancelMessage: 'You can leave only while your ticket is waiting. It may have been called or service may have started.' });
		}
		redirect(303, `/t/${params.token}`);
	}
};
