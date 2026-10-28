<script lang="ts">
	import type { PageProps } from "./$types";
	import StaffSidebar from "#lib/StaffSidebar.svelte";
	let { data, form }: PageProps = $props();
</script>

<svelte:head
	><title>Staff access · Kewkew</title><meta
		name="description"
		content="Manage organization staff access."
	/></svelte:head
>
<div class="staff-shell">
	<header class="topbar">
		<a class="brand" href="/staff"
			><span class="brand-mark">k</span><span class="brand-name"
				>Kewkew<small>Queue, without the wait</small></span
			></a
		><a class="staff-signout" href="/staff">Back to workspace</a>
	</header>
	<div class="staff-workspace">
		<StaffSidebar
			organizationId={data.organization.id}
			organizationRole="admin"
			locationCount={data.locations.length}
			active="staff"
		/>
		<main class="staff-content">
			<div class="staff-page">
				<header class="staff-page-heading">
					<div>
						<p class="eyebrow">Organization setup</p>
						<h1>Staff access</h1>
						<p class="staff-page-subhead">
							Invite teammates and control their organization
							access.
						</p>
					</div>
				</header>
				{#if form?.message}<p
						class="staff-feedback error-message"
						role="alert"
					>
						{form.message}
					</p>{/if}
				{#if form?.success}<p
						class="staff-feedback success-message"
						role="status"
					>
						{form.success}
					</p>{/if}
				<section class="staff-card">
					<div class="staff-card-heading">
						<h2>Invite a teammate</h2>
						<span class="staff-card-tag"
							>{data.organization.name}</span
						>
					</div>
					<form
						method="POST"
						action={`?/sendInvitation&organization=${encodeURIComponent(data.organization.id)}`}
						class="access-form"
					>
						<label
							>Email address<input
								type="email"
								name="email"
								autocomplete="email"
								required
							/></label
						>
						<label
							>Role<select name="role"
								><option value="operator">Operator</option
								><option value="admin">Administrator</option
								></select
							></label
						>
						<fieldset>
							<legend>Operator locations</legend
							>{#each data.locations as location}<label
									class="access-checkbox"
									><input
										type="checkbox"
										name="locationIds"
										value={location.id}
									/>{location.name}</label
								>{/each}<small
								>Administrators have access to all locations.</small
							>
						</fieldset>
						<button type="submit" class="queue-create-submit"
							>Send seven-day invitation</button
						>
					</form>
				</section>
				<section class="staff-card">
					<div class="staff-card-heading">
						<h2>Current members</h2>
						<span class="staff-card-tag"
							>{data.members.length} staff</span
						>
					</div>
					<div class="access-members">
						{#each data.members as member (member.userId)}
							<article class="access-member">
								<div class="access-member-heading">
									<div>
										<strong>{member.name}</strong><small
											>{member.email}</small
										>
									</div>
									<span
										class:inactive={member.status ===
											"suspended"}
										class="location-status"
										>{member.status}</span
									>
								</div>
								<form
									method="POST"
									action={`?/updateMembership&organization=${encodeURIComponent(data.organization.id)}&member=${encodeURIComponent(member.userId)}`}
									class="access-form"
								>
									<label
										>Role<select
											name="role"
											value={member.role}
											><option value="operator"
												>Operator</option
											><option value="admin"
												>Administrator</option
											></select
										></label
									>
									<fieldset>
										<legend>Operator locations</legend
										>{#each data.locations as location}<label
												class="access-checkbox"
												><input
													type="checkbox"
													name="locationIds"
													value={location.id}
													checked={member.locations.includes(
														location.id,
													)}
												/>{location.name}</label
											>{/each}<small
											>Administrators have access to all
											locations. Operators need at least
											one.</small
										>
									</fieldset>
									<button
										type="submit"
										class="queue-create-submit"
										>Save access</button
									>
								</form>
								<form
									method="POST"
									action={`?/setStatus&organization=${encodeURIComponent(data.organization.id)}&member=${encodeURIComponent(member.userId)}`}
								>
									<button
										class="location-status-button"
										type="submit"
										>{member.status === "active"
											? "Suspend membership"
											: "Restore membership"}</button
									>
								</form>
							</article>
						{/each}
					</div>
				</section>
				<section class="staff-card">
					<div class="staff-card-heading">
						<h2>Pending invitations</h2>
						<span class="staff-card-tag"
							>{data.invitations.length}</span
						>
					</div>
					{#if data.invitations.length === 0}<p
							class="staff-empty-copy"
						>
							No pending invitations.
						</p>{:else}<ul class="access-invitations">
							{#each data.invitations as invitation (invitation.id)}<li
								>
									<span
										><strong
											>{invitation.invitedEmail}</strong
										><small
											>{invitation.role} · {invitation.deliveryState}
											· expires {new Date(
												invitation.expiresAt,
											).toLocaleDateString()}</small
										></span
									>
									<form
										method="POST"
										action={`?/revokeInvitation&organization=${encodeURIComponent(data.organization.id)}&invitation=${encodeURIComponent(invitation.id)}`}
									>
										<button
											type="submit"
											class="location-status-button"
											>Revoke</button
										>
									</form>
								</li>{/each}
						</ul>{/if}
				</section>
			</div>
		</main>
	</div>
</div>

<style>
	.access-form {
		display: grid;
		gap: 14px;
		margin-top: 18px;
	}
	.access-form > label {
		display: grid;
		gap: 7px;
		color: var(--ink);
		font-size: 12px;
		font-weight: 700;
	}
	.access-form input[type="email"],
	.access-form select {
		width: 100%;
		min-height: 42px;
		padding: 9px 11px;
		border: 1px solid var(--line);
		border-radius: 9px;
		background: white;
	}
	.access-form fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 18px;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: 10px;
	}
	.access-form legend {
		padding: 0 5px;
		color: var(--muted);
		font-size: 11px;
		font-weight: 750;
	}
	.access-checkbox {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 12px;
	}
	.access-form small,
	.access-member-heading small,
	.access-invitations small {
		display: block;
		flex-basis: 100%;
		color: var(--muted);
		font-size: 11px;
	}
	.access-members {
		display: grid;
		gap: 15px;
	}
	.access-member {
		padding: 16px 0;
		border-top: 1px solid var(--line);
	}
	.access-member-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.access-invitations {
		padding: 0;
		margin: 0;
		list-style: none;
	}
	.access-invitations li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 15px;
		padding: 13px 0;
		border-top: 1px solid var(--line);
	}
</style>
