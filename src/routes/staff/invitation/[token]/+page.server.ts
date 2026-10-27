import { env as cloudflareEnv } from 'cloudflare:workers';
import { fail, error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { hashPassword } from 'better-auth/crypto';
import type { BatchItem } from 'drizzle-orm/batch';
import { and, count, eq, exists, gt, isNull, not, or, sql } from 'drizzle-orm';
import { createDatabase } from '../../../../lib/server/database';
import {
	accounts,
	locations,
	membershipAuditEvents,
	membershipLocationAccess,
	organizationMemberships,
	organizations,
	staffInvitations,
	users
} from '../../../../lib/server/schema';

async function digest(value: string) {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getDatabase() {
	return createDatabase((cloudflareEnv as Env).DB);
}

async function getInvitation(db: ReturnType<typeof getDatabase>, tokenDigest: string) {
	const [invitation] = await db
		.select({
			id: staffInvitations.id,
			organizationId: staffInvitations.organizationId,
			organizationName: organizations.name,
			invitedEmail: staffInvitations.invitedEmail,
			role: staffInvitations.role,
			locationIdsJson: staffInvitations.locationIdsJson,
			expiresAt: staffInvitations.expiresAt,
			acceptedAt: staffInvitations.acceptedAt,
			revokedAt: staffInvitations.revokedAt,
			deliveryState: staffInvitations.deliveryState
		})
		.from(staffInvitations)
		.innerJoin(organizations, eq(organizations.id, staffInvitations.organizationId))
		.where(eq(staffInvitations.tokenDigest, tokenDigest))
		.limit(1);
	return invitation;
}

export const load: PageServerLoad = async ({ params }) => {
	const invitation = await getInvitation(getDatabase(), await digest(params.token));
	if (!invitation || invitation.deliveryState !== 'sent' || invitation.acceptedAt || invitation.revokedAt || new Date(invitation.expiresAt) <= new Date()) {
		error(404, 'This invitation is invalid or has expired. Ask an administrator to issue a new one.');
	}
	return { invitedEmail: invitation.invitedEmail, organizationName: invitation.organizationName, role: invitation.role };
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const db = getDatabase();
		const tokenDigest = await digest(params.token);
		const invitation = await getInvitation(db, tokenDigest);
		const now = new Date().toISOString();
		if (!invitation || invitation.deliveryState !== 'sent' || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now) {
			return fail(400, { message: 'This invitation is invalid or has expired. Ask an administrator to issue a new one.' });
		}
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const password = String(form.get('password') ?? '');
		let userId = locals.user?.id;
		let createIdentity = false;
		if (userId) {
			if (locals.user!.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) return fail(403, { message: 'Sign in with the email address that received this invitation.' });
		} else {
			const [existing] = await db.select({ id: users.id }).from(users)
				.where(sql`lower(${users.email}) = ${invitation.invitedEmail.toLowerCase()}`).limit(1);
			if (existing) return fail(401, { message: 'This email already has an account. Sign in first, then reopen this invitation link.' });
			if (!name || name.length > 160 || password.length < 8 || password.length > 128) return fail(400, { message: 'Enter your name and a password between 8 and 128 characters.' });
			userId = crypto.randomUUID();
			createIdentity = true;
		}

		const activeAdmins = db.select({ value: count() }).from(organizationMemberships).where(and(
			eq(organizationMemberships.organizationId, invitation.organizationId),
			eq(organizationMemberships.role, 'admin'),
			eq(organizationMemberships.status, 'active')
		));
		const existingActiveAdmin = db.select({ userId: organizationMemberships.userId }).from(organizationMemberships).where(and(
			eq(organizationMemberships.organizationId, invitation.organizationId),
			eq(organizationMemberships.userId, userId),
			eq(organizationMemberships.role, 'admin'),
			eq(organizationMemberships.status, 'active')
		));
		const accepted = db.update(staffInvitations).set({ acceptedByUserId: userId, acceptedAt: now }).where(and(
			eq(staffInvitations.id, invitation.id),
			eq(staffInvitations.tokenDigest, tokenDigest),
			eq(staffInvitations.invitedEmail, invitation.invitedEmail),
			eq(staffInvitations.deliveryState, 'sent'),
			isNull(staffInvitations.acceptedAt),
			isNull(staffInvitations.revokedAt),
			gt(staffInvitations.expiresAt, now),
			or(not(exists(existingActiveAdmin)), eq(staffInvitations.role, 'admin'), sql`(${activeAdmins}) > 1`)
		));
		const operations: BatchItem<'sqlite'>[] = [accepted];
		const acceptanceMarker = and(
			eq(staffInvitations.id, invitation.id),
			eq(staffInvitations.acceptedByUserId, userId),
			eq(staffInvitations.acceptedAt, now)
		);
		if (createIdentity) {
			const passwordHash = await hashPassword(password);
			operations.push(db.insert(users).select(db.select({
				id: sql<string>`${userId}`.as('id'),
				name: sql<string>`${name}`.as('name'),
				email: staffInvitations.invitedEmail,
				emailVerified: sql<number>`1`.as('email_verified'),
				image: sql<null>`NULL`.as('image'),
				createdAt: sql<string>`${now}`.as('created_at'),
				updatedAt: sql<string>`${now}`.as('updated_at')
			}).from(staffInvitations).where(acceptanceMarker)));
			operations.push(db.insert(accounts).select(db.select({
				id: sql<string>`${crypto.randomUUID()}`.as('id'),
				accountId: sql<string>`${userId}`.as('account_id'),
				providerId: sql<string>`'credential'`.as('provider_id'),
				userId: sql<string>`${userId}`.as('user_id'),
				accessToken: sql<null>`NULL`.as('access_token'),
				refreshToken: sql<null>`NULL`.as('refresh_token'),
				idToken: sql<null>`NULL`.as('id_token'),
				accessTokenExpiresAt: sql<null>`NULL`.as('access_token_expires_at'),
				refreshTokenExpiresAt: sql<null>`NULL`.as('refresh_token_expires_at'),
				scope: sql<null>`NULL`.as('scope'),
				password: sql<string>`${passwordHash}`.as('password'),
				createdAt: sql<string>`${now}`.as('created_at'),
				updatedAt: sql<string>`${now}`.as('updated_at')
			}).from(staffInvitations).where(acceptanceMarker)));
		}
		operations.push(db.insert(organizationMemberships).select(db.select({
			organizationId: staffInvitations.organizationId,
			userId: sql<string>`${userId}`.as('user_id'),
			role: staffInvitations.role,
			status: sql<'active'>`'active'`.as('status'),
			createdAt: sql<string>`${now}`.as('created_at'),
			updatedAt: sql<string>`${now}`.as('updated_at')
		}).from(staffInvitations).where(acceptanceMarker)).onConflictDoUpdate({
			target: [organizationMemberships.organizationId, organizationMemberships.userId],
			set: { role: sql`excluded.role`, status: 'active', updatedAt: now }
		}));
		operations.push(db.delete(membershipLocationAccess).where(and(
			eq(membershipLocationAccess.organizationId, invitation.organizationId),
			eq(membershipLocationAccess.userId, userId),
			exists(db.select({ id: staffInvitations.id }).from(staffInvitations).where(acceptanceMarker))
		)));
		if (invitation.role === 'operator') {
			const locationIds = JSON.parse(invitation.locationIdsJson) as string[];
			for (const locationId of locationIds) operations.push(db.insert(membershipLocationAccess).select(db.select({
				organizationId: staffInvitations.organizationId,
				userId: sql<string>`${userId}`.as('user_id'),
				locationId: sql<string>`${locationId}`.as('location_id'),
				createdAt: sql<string>`${now}`.as('created_at')
			}).from(staffInvitations).innerJoin(locations, and(
				eq(locations.organizationId, staffInvitations.organizationId),
				eq(locations.id, sql`${locationId}`)
			)).where(acceptanceMarker)));
		}
		operations.push(db.insert(membershipAuditEvents).select(db.select({
			id: sql<string>`${crypto.randomUUID()}`.as('id'),
			organizationId: staffInvitations.organizationId,
			actorUserId: staffInvitations.createdByUserId,
			subjectUserId: sql<string>`${userId}`.as('subject_user_id'),
			changeType: sql<'invitation_accepted'>`'invitation_accepted'`.as('change_type'),
			beforeRole: sql<null>`NULL`.as('before_role'),
			afterRole: staffInvitations.role,
			beforeStatus: sql<null>`NULL`.as('before_status'),
			afterStatus: sql<'active'>`'active'`.as('after_status'),
			detailsJson: sql<string>`json_object('invitation_id', ${staffInvitations.id})`.as('details_json'),
			createdAt: sql<string>`${now}`.as('created_at')
		}).from(staffInvitations).where(acceptanceMarker)));
		try {
			const result = await db.batch(operations as unknown as Parameters<typeof db.batch>[0]);
			if (result[0]?.meta.changes !== 1) return fail(409, { message: 'This invitation has already been used or is no longer valid.' });
		} catch {
			return fail(400, { message: 'The invitation could not be accepted. No access was changed; contact an administrator.' });
		}
		redirect(303, '/staff/sign-in?invitation=accepted');
	}
};
