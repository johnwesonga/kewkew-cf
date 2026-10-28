<script lang="ts">
	import StaffSidebar from '../../../../lib/StaffSidebar.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let initials = $derived(data.user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join(''));
	let organizationQuery = $derived(`?organization=${encodeURIComponent(data.organization.organizationId)}`);
</script>

<svelte:head>
	<title>Edit {data.queue.name} · Queues · Kewkew</title>
	<meta name="description" content="Edit queue configuration." />
</svelte:head>

<div class="staff-shell">
	<header class="topbar">
		<a class="brand" href="/staff" aria-label="Kewkew staff workspace">
			<span class="brand-mark" aria-hidden="true">k</span>
			<span class="brand-name">Kewkew<small>Queue, without the wait</small></span>
		</a>
		<div class="staff-header-actions">
			{#if data.organizations.length > 1}
				<form class="staff-workspace-switcher" method="GET" action={`/staff/queues/${encodeURIComponent(data.queue.id)}`}>
					<label for="organization-switch">Organization</label>
					<select id="organization-switch" name="organization" value={data.organization.organizationId}>
						{#each data.organizations as organization}<option value={organization.organizationId}>{organization.organizationName}</option>{/each}
					</select>
					<button type="submit">Switch</button>
				</form>
			{:else}
				<span class="staff-current-organization">{data.organization.organizationName}</span>
			{/if}
			<div class="staff-account-chip">
				<span class="staff-avatar" aria-hidden="true">{initials}</span>
				<span class="staff-account-copy"><strong>{data.user.name}</strong><small>{data.user.email}</small></span>
			</div>
			<form method="POST" action="/staff?/signOut"><button class="staff-signout" type="submit">Sign out</button></form>
		</div>
	</header>

	<div class="staff-workspace">
		<StaffSidebar organizationId={data.organization.organizationId} organizationRole="admin" locationCount={data.locationCount} active="queues" />
		<main class="staff-content">
			<div class="staff-page">
				<a class="queue-back-link" href={`/staff/queues${organizationQuery}`}>← Back to queues</a>
				<header class="staff-page-heading queue-edit-heading">
					<div>
						<p class="eyebrow">Queue configuration</p>
						<h1>Edit queue</h1>
						<p class="staff-page-subhead">Update future visitor rules for {data.queue.name}.</p>
					</div>
				</header>
				{#if form?.message}<p class="staff-feedback error-message" role="alert">{form.message}</p>{/if}

				<section class="staff-card queue-edit-card" aria-labelledby="queue-edit-title">
					<div class="staff-card-heading">
						<div><h2 id="queue-edit-title">Queue details</h2><p class="queue-edit-context">Location and service are fixed after creation.</p></div>
				</div>
				<dl class="queue-fixed-details">
					<div><dt>Location</dt><dd>{data.queue.locationName}</dd></div>
					<div><dt>Service</dt><dd>{data.queue.serviceName}</dd></div>
				</dl>
				<form class="queue-edit-form" method="POST" action={`?/updateQueue&organization=${encodeURIComponent(data.organization.organizationId)}`}>
					<label>Queue name
						<input name="queueName" maxlength="160" required value={form?.queueName ?? data.queue.name} autocomplete="off" />
					</label>
					<label>Visitor identity
						<select name="identityPolicy" required value={form?.identityPolicy ?? data.queue.identityPolicy}>
							<option value="anonymous">Anonymous tickets</option>
							<option value="name_required">Require first and last name</option>
						</select>
						<span class="queue-label-hint">Changes apply to future joins. Existing tickets remain unchanged.</span>
					</label>
					<label>Active ticket capacity <span class="queue-label-hint">Optional; leave blank for unlimited</span>
						<input type="number" name="activeTicketCapacity" min="1" step="1" inputmode="numeric" value={form?.activeTicketCapacity ?? data.queue.activeTicketCapacity ?? ''} />
						<span class="queue-label-hint">Lowering the limit will not cancel existing tickets.</span>
					</label>
					<div class="queue-edit-actions">
						<button type="submit" class="queue-create-submit">Save changes</button>
						<a class="queue-cancel-link" href={`/staff/queues${organizationQuery}`}>Cancel</a>
					</div>
				</form>
			</section>
			</div>
		</main>
	</div>
</div>
