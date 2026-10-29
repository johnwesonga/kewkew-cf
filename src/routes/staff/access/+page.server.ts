import { env as cloudflareEnv } from 'cloudflare:workers';
import { fail, error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { BatchItem } from 'drizzle-orm/batch';
import { sendInvitationEmail } from '#lib/server/email';
import { and, asc, count, desc, eq, exists, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { createDatabase } from '#lib/server/database';
import {
	locations,
	membershipAuditEvents,
	membershipLocationAccess,
	organizationMemberships,
	organizations,
	staffInvitations,
	users
} from '#lib/server/schema';

type Role = 'admin' | 'operator';
type Status = 'active' | 'suspended';

async function digest(value: string) {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(value: string) {
	return value.replace(/[&<>"']/gu, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

function getDatabase() {
	return createDatabase((cloudflareEnv as Env).DB);
}

async function requireAdmin(db: ReturnType<typeof getDatabase>, organizationId: string, userId: string) {
	const [membership] = await db
		.select({ userId: organizationMemberships.userId })
		.from(organizationMemberships)
		.where(and(
			eq(organizationMemberships.organizationId, organizationId),
			eq(organizationMemberships.userId, userId),
			eq(organizationMemberships.role, 'admin'),
			eq(organizationMemberships.status, 'active')
		))
		.limit(1);
	if (!membership) error(404, 'Workspace not found');
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, '/staff/sign-in');
	const db = getDatabase();
	const adminMemberships = await db
		.select({ id: organizations.id, name: organizations.name })
		.from(organizations)
		.innerJoin(organizationMemberships, eq(organizationMemberships.organizationId, organizations.id))
		.where(and(
			eq(organizationMemberships.userId, locals.user.id),
			eq(organizationMemberships.status, 'active'),
			eq(organizationMemberships.role, 'admin')
		))
		.orderBy(asc(sql`lower(${organizations.name})`), asc(organizations.id));
	if (!adminMemberships.length) error(404, 'Workspace not found');
	const requested = url.searchParams.get('organization');
	const organization = adminMemberships.find((item) => item.id === requested) ?? adminMemberships[0]!;
	await requireAdmin(db, organization.id, locals.user.id);
	const [locationRows, memberRows, assignmentRows, invitationRows] = await Promise.all([
		db.select({ id: locations.id, name: locations.name })
			.from(locations).where(eq(locations.organizationId, organization.id))
			.orderBy(asc(sql`lower(${locations.name})`), asc(locations.id)),
		db.select({
			userId: users.id, name: users.name, email: users.email,
			role: organizationMemberships.role, status: organizationMemberships.status
		})
			.from(organizationMemberships)
			.innerJoin(users, eq(users.id, organizationMemberships.userId))
			.where(eq(organizationMemberships.organizationId, organization.id))
			.orderBy(asc(sql`lower(${users.name})`), asc(users.id)),
		db.select({ userId: membershipLocationAccess.userId, locationId: membershipLocationAccess.locationId })
			.from(membershipLocationAccess).where(eq(membershipLocationAccess.organizationId, organization.id)),
		db.select({
			id: staffInvitations.id,
			invitedEmail: staffInvitations.invitedEmail,
			role: staffInvitations.role,
			deliveryState: staffInvitations.deliveryState,
			createdAt: staffInvitations.createdAt,
			expiresAt: staffInvitations.expiresAt
		})
			.from(staffInvitations)
			.where(and(
				eq(staffInvitations.organizationId, organization.id),
				isNull(staffInvitations.acceptedAt),
				isNull(staffInvitations.revokedAt)
			))
			.orderBy(desc(staffInvitations.createdAt)).limit(50)
	]);
	const assignments = new Map<string, string[]>();
	for (const row of assignmentRows) assignments.set(row.userId, [...(assignments.get(row.userId) ?? []), row.locationId]);
	return {
		organization,
		organizations: adminMemberships,
		locations: locationRows,
		members: memberRows.map((member) => ({ ...member, locations: assignments.get(member.userId) ?? [] })),
		invitations: invitationRows
	};
};

export const actions: Actions = {
	sendInvitation: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');
		const env = cloudflareEnv as Env;
		const db = getDatabase();
		const organizationId = url.searchParams.get('organization') ?? '';
		await requireAdmin(db, organizationId, locals.user.id);
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const role = String(form.get('role') ?? '');
		const locationIds = [...new Set(form.getAll('locationIds').map(String))];
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || !['admin', 'operator'].includes(role)) return fail(400, { message: 'Enter a valid email and role.' });
		if (role === 'operator' && locationIds.length === 0) return fail(400, { message: 'Choose at least one location for an operator.' });
		const locationRows = locationIds.length
			? await db.select({ id: locations.id }).from(locations).where(and(eq(locations.organizationId, organizationId), inArray(locations.id, locationIds)))
			: [];
		if (role === 'operator' && locationRows.length !== locationIds.length) return fail(400, { message: 'Choose locations from this organization.' });
		const [existingMember] = await db
			.select({ id: users.id })
			.from(users)
			.innerJoin(organizationMemberships, eq(organizationMemberships.userId, users.id))
			.where(and(eq(organizationMemberships.organizationId, organizationId), sql`lower(${users.email}) = ${email}`))
			.limit(1);
		if (existingMember) return fail(409, { message: 'This person is already a member of the organization.' });
		if (!env.RESEND_API_KEY || !env.INVITATION_FROM_EMAIL) return fail(503, { message: 'Invitation email is not configured. Set RESEND_API_KEY and INVITATION_FROM_EMAIL.' });
		if (url.protocol !== 'https:' && url.hostname !== 'localhost') return fail(503, { message: 'Invitation links require HTTPS outside local development.' });
		const token = [...crypto.getRandomValues(new Uint8Array(32))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
		const id = crypto.randomUUID();
		const now = new Date();
		const createdAt = now.toISOString();
		const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
		const inviteUrl = new URL(`/staff/invitation/${token}`, url.origin).toString();
		const [organizationRow] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
		const priorInvites = db.update(staffInvitations).set({ revokedAt: createdAt }).where(and(
			eq(staffInvitations.organizationId, organizationId),
			eq(staffInvitations.invitedEmail, email),
			isNull(staffInvitations.acceptedAt),
			isNull(staffInvitations.revokedAt),
			exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
				eq(organizationMemberships.organizationId, organizationId),
				eq(organizationMemberships.userId, locals.user.id),
				eq(organizationMemberships.role, 'admin'),
				eq(organizationMemberships.status, 'active')
			)))
		));
		const insertInvite = db.insert(staffInvitations).select(db.select({
			id: sql<string>`${id}`.as('id'),
			organizationId: organizationMemberships.organizationId,
			invitedEmail: sql<string>`${email}`.as('invited_email'),
			role: sql<Role>`${role}`.as('role'),
			locationIdsJson: sql<string>`${JSON.stringify(role === 'admin' ? [] : locationIds)}`.as('location_ids_json'),
			tokenDigest: sql<string>`${await digest(token)}`.as('token_digest'),
			createdByUserId: organizationMemberships.userId,
			createdAt: sql<string>`${createdAt}`.as('created_at'),
			expiresAt: sql<string>`${expiresAt}`.as('expires_at'),
			deliveryState: sql<'failed'>`'failed'`.as('delivery_state'),
			acceptedByUserId: sql<null>`NULL`.as('accepted_by_user_id'),
			acceptedAt: sql<null>`NULL`.as('accepted_at'),
			revokedAt: sql<null>`NULL`.as('revoked_at')
		}).from(organizationMemberships).where(and(
			eq(organizationMemberships.organizationId, organizationId),
			eq(organizationMemberships.userId, locals.user.id),
			eq(organizationMemberships.role, 'admin'),
			eq(organizationMemberships.status, 'active')
		)));
		const inserted = await db.batch([priorInvites, insertInvite]);
		if (inserted[1]?.meta.changes !== 1) error(404, 'Workspace not found');
		try {
			await sendInvitationEmail({
				apiKey: env.RESEND_API_KEY,
				from: env.INVITATION_FROM_EMAIL,
				to: email,
				subject: `Invitation to ${organizationRow?.name ?? 'Kewkew'}`,
				text: `You have been invited to ${organizationRow?.name ?? 'Kewkew'} as an ${role}. Accept within seven days: ${inviteUrl}`,
				html: `<p>You have been invited to <strong>${escapeHtml(organizationRow?.name ?? 'Kewkew')}</strong> as an ${escapeHtml(role)}.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in seven days and can be used once.</p>`,
				idempotencyKey: id
			});
			await db.update(staffInvitations).set({ deliveryState: 'sent' }).where(eq(staffInvitations.id, id));
		} catch {
			return fail(502, { message: 'The invitation was recorded but email delivery failed. Revoke it and issue a fresh invitation after checking email delivery.' });
		}
		return { success: `Invitation sent to ${email}.` };
	},
	updateMembership: async ({ locals, request, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');
		const db = getDatabase();
		const organizationId = url.searchParams.get('organization') ?? '';
		const userId = url.searchParams.get('member') ?? '';
		await requireAdmin(db, organizationId, locals.user.id);
		const form = await request.formData();
		const role = String(form.get('role') ?? '');
		const locationIds = [...new Set(form.getAll('locationIds').map(String))];
		if (!['admin', 'operator'].includes(role) || (role === 'operator' && !locationIds.length)) return fail(400, { message: 'Operators must have at least one location.' });
		const roleValue = role as Role;
		const locationRows = roleValue === 'admin' ? [] : await db.select({ id: locations.id }).from(locations).where(and(
			eq(locations.organizationId, organizationId), inArray(locations.id, locationIds)
		));
		if (roleValue === 'operator' && locationRows.length !== locationIds.length) return fail(400, { message: 'Choose locations from this organization.' });
		const [current] = await db.select({ role: organizationMemberships.role, status: organizationMemberships.status })
			.from(organizationMemberships).where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, userId))).limit(1);
		if (!current) error(404, 'Member not found');
		const now = new Date().toISOString();
		const beforeLocations = await db.select({ locationId: membershipLocationAccess.locationId }).from(membershipLocationAccess)
			.where(and(eq(membershipLocationAccess.organizationId, organizationId), eq(membershipLocationAccess.userId, userId)))
			.orderBy(asc(membershipLocationAccess.locationId));
		const details = JSON.stringify({ beforeLocations: beforeLocations.map((row) => row.locationId), afterLocations: roleValue === 'admin' ? [] : locationIds });
		const activeAdmins = db.select({ value: count() }).from(organizationMemberships).where(and(
			eq(organizationMemberships.organizationId, organizationId),
			eq(organizationMemberships.role, 'admin'),
			eq(organizationMemberships.status, 'active')
		));
		const updatedMembership = db.update(organizationMemberships).set({ role: roleValue, updatedAt: now }).where(and(
			eq(organizationMemberships.organizationId, organizationId),
			eq(organizationMemberships.userId, userId),
			exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
				eq(organizationMemberships.organizationId, organizationId),
				eq(organizationMemberships.userId, locals.user.id),
				eq(organizationMemberships.role, 'admin'),
				eq(organizationMemberships.status, 'active')
			))),
			or(ne(organizationMemberships.role, 'admin'), eq(sql<Role>`${roleValue}`, 'admin'), sql`(${activeAdmins}) > 1`)
		));
		const operations: BatchItem<'sqlite'>[] = [updatedMembership];
		const marker = and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, userId), eq(organizationMemberships.role, roleValue), eq(organizationMemberships.updatedAt, now));
		operations.push(db.delete(membershipLocationAccess).where(and(
			eq(membershipLocationAccess.organizationId, organizationId),
			eq(membershipLocationAccess.userId, userId),
			exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(marker))
		)));
		if (roleValue === 'operator') for (const locationId of locationIds) operations.push(db.insert(membershipLocationAccess).select(db.select({
			organizationId: sql<string>`${organizationId}`.as('organization_id'),
			userId: sql<string>`${userId}`.as('user_id'),
			locationId: sql<string>`${locationId}`.as('location_id'),
			createdAt: sql<string>`${now}`.as('created_at')
		}).from(organizationMemberships).where(and(marker, eq(organizationMemberships.role, 'operator')))));
		operations.push(db.insert(membershipAuditEvents).select(db.select({
			id: sql<string>`${crypto.randomUUID()}`.as('id'),
			organizationId: sql<string>`${organizationId}`.as('organization_id'),
			actorUserId: sql<string>`${locals.user.id}`.as('actor_user_id'),
			subjectUserId: sql<string>`${userId}`.as('subject_user_id'),
			changeType: sql<'role_changed' | 'location_access_changed'>`${current.role === roleValue ? 'location_access_changed' : 'role_changed'}`.as('change_type'),
			beforeRole: sql<Role>`${current.role}`.as('before_role'),
			afterRole: sql<Role>`${roleValue}`.as('after_role'),
			beforeStatus: sql<Status>`${current.status}`.as('before_status'),
			afterStatus: sql<Status>`${current.status}`.as('after_status'),
			detailsJson: sql<string>`${details}`.as('details_json'),
			createdAt: sql<string>`${now}`.as('created_at')
		}).from(organizationMemberships).where(marker)));
		const result = await db.batch(operations as unknown as Parameters<typeof db.batch>[0]);
		if (result[0]?.meta.changes !== 1) return fail(409, { message: 'Update could not be applied. The last active administrator cannot be demoted.' });
		return { success: 'Staff access updated.' };
	},
	setStatus: async ({ locals, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');
		const db = getDatabase();
		const organizationId = url.searchParams.get('organization') ?? '';
		const userId = url.searchParams.get('member') ?? '';
		await requireAdmin(db, organizationId, locals.user.id);
		const [member] = await db.select({ role: organizationMemberships.role, status: organizationMemberships.status })
			.from(organizationMemberships).where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, userId))).limit(1);
		if (!member) error(404, 'Member not found');
		const next: Status = member.status === 'active' ? 'suspended' : 'active';
		const now = new Date().toISOString();
		const adminCount = db.select({ value: count() }).from(organizationMemberships).where(and(
			eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.role, 'admin'), eq(organizationMemberships.status, 'active')
		));
		const update = db.update(organizationMemberships).set({ status: next, updatedAt: now }).where(and(
			eq(organizationMemberships.organizationId, organizationId),
			eq(organizationMemberships.userId, userId),
			eq(organizationMemberships.status, member.status),
			exists(db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
				eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, locals.user.id),
				eq(organizationMemberships.role, 'admin'), eq(organizationMemberships.status, 'active')
			))),
			or(ne(organizationMemberships.status, 'active'), ne(organizationMemberships.role, 'admin'), sql`(${adminCount}) > 1`)
		));
		const marker = and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, userId), eq(organizationMemberships.status, next), eq(organizationMemberships.updatedAt, now));
		const audit = db.insert(membershipAuditEvents).select(db.select({
			id: sql<string>`${crypto.randomUUID()}`.as('id'), organizationId: sql<string>`${organizationId}`.as('organization_id'),
			actorUserId: sql<string>`${locals.user.id}`.as('actor_user_id'), subjectUserId: sql<string>`${userId}`.as('subject_user_id'),
			changeType: sql<'suspended' | 'reactivated'>`${next === 'active' ? 'reactivated' : 'suspended'}`.as('change_type'),
			beforeRole: organizationMemberships.role, afterRole: organizationMemberships.role,
			beforeStatus: sql<Status>`${member.status}`.as('before_status'), afterStatus: organizationMemberships.status,
			detailsJson: sql<null>`NULL`.as('details_json'), createdAt: sql<string>`${now}`.as('created_at')
		}).from(organizationMemberships).where(marker));
		const result = await db.batch([update, audit]);
		if (result[0]?.meta.changes !== 1 || result[1]?.meta.changes !== 1) return fail(409, { message: 'The last active administrator cannot be suspended.' });
		return { success: next === 'active' ? 'Membership restored.' : 'Membership suspended.' };
	},
	revokeInvitation: async ({ locals, url }) => {
		if (!locals.user) redirect(303, '/staff/sign-in');
		const db = getDatabase();
		const organizationId = url.searchParams.get('organization') ?? '';
		const invitationId = url.searchParams.get('invitation') ?? '';
		await requireAdmin(db, organizationId, locals.user.id);
		const result = await db.update(staffInvitations).set({ revokedAt: new Date().toISOString() }).where(and(
			eq(staffInvitations.id, invitationId), eq(staffInvitations.organizationId, organizationId),
			isNull(staffInvitations.acceptedAt), isNull(staffInvitations.revokedAt)
		));
		if (result.meta.changes !== 1) return fail(404, { message: 'Invitation is no longer pending.' });
		return { success: 'Invitation revoked. Issue a new invitation to retry.' };
	}
};
