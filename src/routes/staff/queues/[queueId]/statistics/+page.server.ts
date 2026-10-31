import { env as cloudflareEnv } from 'cloudflare:workers';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { and, asc, count, eq, exists, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import { locations, membershipLocationAccess, organizationMemberships, organizations, queues, services, tickets } from '#lib/server/schema';
import {
	averageWaitMinutes,
	dateKeyAt,
	emptyQueueStatisticsDays,
	localMidnightAsUtc,
	parseQueueStatisticsRange
} from '#lib/queue-statistics';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) redirect(303, '/staff/sign-in');
	const db = createDatabase((cloudflareEnv as Env).DB);
	const userId = locals.user.id;
	const memberships = await db.select({
		organizationId: organizations.id,
		organizationName: organizations.name,
		role: organizationMemberships.role
	})
		.from(organizationMemberships)
		.innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
		.where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.status, 'active')))
		.orderBy(asc(sql`lower(${organizations.name})`), asc(organizations.id));
	if (memberships.length === 0) error(404, 'Queue not found');

	const requestedOrganizationId = url.searchParams.get('organization');
	const organization = requestedOrganizationId
		? memberships.find(({ organizationId }) => organizationId === requestedOrganizationId)
		: memberships[0];
	if (!organization) error(404, 'Queue not found');

	const queue = await db.select({
		id: queues.id,
		name: queues.name,
		organizationId: queues.organizationId,
		locationId: locations.id,
		locationName: locations.name,
		timezone: locations.timezone,
		serviceName: services.name
	})
		.from(queues)
		.innerJoin(locations, and(eq(locations.organizationId, queues.organizationId), eq(locations.id, queues.locationId)))
		.innerJoin(services, and(eq(services.organizationId, queues.organizationId), eq(services.locationId, queues.locationId), eq(services.id, queues.serviceId)))
		.where(and(
			eq(queues.id, params.queueId),
			eq(queues.organizationId, organization.organizationId),
			exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
				eq(organizationMemberships.organizationId, queues.organizationId),
				eq(organizationMemberships.userId, userId),
				eq(organizationMemberships.status, 'active')
			))),
			organization.role === 'operator'
				? exists(db.select({ locationId: membershipLocationAccess.locationId }).from(membershipLocationAccess).where(and(
					eq(membershipLocationAccess.organizationId, queues.organizationId),
					eq(membershipLocationAccess.userId, userId),
					eq(membershipLocationAccess.locationId, queues.locationId)
				)))
				: exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
					eq(organizationMemberships.organizationId, queues.organizationId),
					eq(organizationMemberships.userId, userId),
					eq(organizationMemberships.role, 'admin'),
					eq(organizationMemberships.status, 'active')
				)))
		))
		.get();
	if (!queue) error(404, 'Queue not found');

	const range = parseQueueStatisticsRange(url.searchParams.get('range'));
	const now = new Date();
	const today = dateKeyAt(now, queue.timezone);
	const days = emptyQueueStatisticsDays(today, range);
	const rangeStart = localMidnightAsUtc(days[0].date, queue.timezone);
	let statisticsError = false;
	let waitTotal = 0;
	let waitCount = 0;
	try {
		const completed = await db.select({
			joinedAt: tickets.joinedAt,
			completedAt: tickets.completedAt,
			firstCalledAt: sql<string | null>`(
				SELECT MIN(occurred_at) FROM ticket_events
				WHERE ticket_id = ${tickets.id} AND to_status = 'called'
			)`.as('first_called_at')
		})
			.from(tickets)
			.where(and(
				eq(tickets.organizationId, organization.organizationId),
				eq(tickets.queueId, queue.id),
				eq(tickets.status, 'completed'),
				sql`${tickets.completedAt} >= ${rangeStart}`,
				sql`${tickets.completedAt} <= ${now.toISOString()}`
			));

		const dayIndex = new Map(days.map((day, index) => [day.date, index]));
		const waitTotals = days.map(() => ({ total: 0, count: 0 }));
		for (const ticket of completed) {
			if (!ticket.completedAt) continue;
			const index = dayIndex.get(dateKeyAt(ticket.completedAt, queue.timezone));
			if (index === undefined) continue;
			days[index].served += 1;
			const wait = averageWaitMinutes(ticket.joinedAt, ticket.firstCalledAt);
			if (wait !== null) {
				waitTotals[index].total += wait;
				waitTotals[index].count += 1;
				waitTotal += wait;
				waitCount += 1;
			}
		}
		for (const [index, totals] of waitTotals.entries()) {
			if (totals.count > 0) days[index].averageWaitMinutes = totals.total / totals.count;
		}
	} catch (cause) {
		console.error('Failed to load queue statistics', cause instanceof Error ? cause.message : 'Unknown database error');
		statisticsError = true;
	}

	const servedTotal = days.reduce((sum, day) => sum + day.served, 0);
	const avgWaitMinutes = waitCount > 0 ? waitTotal / waitCount : null;
	const locationCount = await db.select({ value: count() }).from(locations)
		.where(and(
			eq(locations.organizationId, organization.organizationId),
			organization.role === 'operator'
				? exists(db.select({ locationId: membershipLocationAccess.locationId }).from(membershipLocationAccess).where(and(
					eq(membershipLocationAccess.organizationId, locations.organizationId),
					eq(membershipLocationAccess.locationId, locations.id),
					eq(membershipLocationAccess.userId, userId)
				)))
				: sql`1 = 1`
		));
	return {
		user: { name: locals.user.name, email: locals.user.email },
		organizations: memberships,
		organization,
		locationCount: locationCount[0]?.value ?? 0,
		queue: { id: queue.id, name: queue.name, locationName: queue.locationName, serviceName: queue.serviceName, timezone: queue.timezone },
		range,
		rangeStart,
		rangeEnd: now.toISOString(),
		days,
		servedTotal,
		avgWaitMinutes,
		statisticsError
	};
};
