<script lang="ts">
	import StaffSidebar from '#lib/StaffSidebar.svelte';
	import StaffAccountChip from '#lib/StaffAccountChip.svelte';
	import QueueShareLink from '#lib/QueueShareLink.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let organizationQuery = $derived(`?organization=${encodeURIComponent(data.organization.organizationId)}`);
</script>

<svelte:head>
	<title>{data.organization.role === "admin" ? "Configure" : "Open"} {data.queue.name} · Queues · Kewkew</title>
	<meta name="description" content="Configure a queue or open a manual session." />
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
			<StaffAccountChip name={data.user.name} email={data.user.email} />
			<form method="POST" action="/staff?/signOut"><button class="staff-signout" type="submit">Sign out</button></form>
		</div>
	</header>

	<div class="staff-workspace">
		<StaffSidebar organizationId={data.organization.organizationId} organizationRole={data.organization.role} locationCount={data.locationCount} active="queues" />
		<main class="staff-content">
			<div class="staff-page">
				<a class="queue-back-link" href={`/staff/queues${organizationQuery}`}>← Back to queue configuration</a>
				<header class="staff-page-heading queue-edit-heading">
					<div>
						<p class="eyebrow">Queue configuration</p>
					<h1>{data.organization.role === "admin" ? "Queue configuration" : "Open a queue session"}</h1>
					<p class="staff-page-subhead">{data.organization.role === "admin" ? `Update visitor rules or configure a manual session for ${data.queue.name}.` : `Configure and open a manual session for ${data.queue.name}.`}</p>
					</div>
				</header>
				{#if form?.message}<p class="staff-feedback error-message" role="alert">{form.message}</p>{/if}

				{#if data.organization.role === "admin"}
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
				<div class="queue-edit-share">
					<h3>Public link and QR code</h3>
					<QueueShareLink publicId={data.queue.publicId} queueName={data.queue.name} expanded />
				</div>
				<section class="queue-delete-section" aria-labelledby="queue-delete-title">
					<h3 id="queue-delete-title">Delete queue</h3>
					<p>This permanently removes the queue and disables its public link. Only queues with no session history can be deleted. If this queue has been operated, deactivate it from the queue list instead.</p>
					<form method="POST" action={`?/deleteQueue&organization=${encodeURIComponent(data.organization.organizationId)}`}>
						<label><input type="checkbox" name="confirmDeletion" value="yes" required /> I understand this permanently deletes this queue.</label>
						<button type="submit" class="queue-delete-button">Delete queue</button>
					</form>
				</section>
			</section>
				{/if}

				<section class="staff-card manual-session-config-card" aria-labelledby="manual-session-title">
					<div class="staff-card-heading"><div><h2 id="manual-session-title">Manual session</h2><p class="queue-edit-context">Optionally set when service is scheduled to start for this session.</p></div></div>
					{#if data.queue.sessionId}
						<p class="staff-feedback success-message">A session is already {data.queue.sessionState}. Manage it on the live board.</p>
						<a class="queue-edit-link" href={`/staff/queues/${encodeURIComponent(data.queue.id)}/board?organization=${encodeURIComponent(data.organization.organizationId)}`}>Open live board</a>
					{:else if data.queue.scheduleEnabled === 1}
						<p class="queue-edit-context">This queue has a recurring schedule. It opens sessions automatically.</p>
						{#if data.organization.role === "admin"}<a class="queue-edit-link" href={`/staff/queues/${encodeURIComponent(data.queue.id)}/schedule?organization=${encodeURIComponent(data.organization.organizationId)}`}>Manage recurring schedule</a>{/if}
					{:else if data.queue.isActive !== 1 || data.queue.locationIsActive !== 1 || data.queue.serviceIsActive !== 1}
						<p class="queue-edit-context">Activate the queue, location, and service before opening a session.</p>
					{:else}
						<form class="manual-session-config-form" method="POST" action={`/staff/queues?/openSession&organization=${encodeURIComponent(data.organization.organizationId)}`}>
							<input type="hidden" name="queueId" value={data.queue.id} />
							<input type="hidden" name="openRequestId" value={data.openRequestId} />
							<input type="hidden" name="returnTo" value="/staff/live" />
							<label class="manual-session-time-field" for="configured-service-start-date">Service start date <input id="configured-service-start-date" type="date" name="scheduledServiceStartDate" /></label>
							<label class="manual-session-time-field" for="configured-service-start-time">Service start time ({data.queue.timezone}) <input id="configured-service-start-time" type="time" name="scheduledServiceStartTime" /></label>
							<p class="queue-edit-context">Both fields are optional. Leave them blank for no scheduled start. Repeated daylight-saving times use the earlier instant; nonexistent times cannot be selected.</p>
							<div class="queue-edit-actions"><button type="submit" class="queue-create-submit">Open session</button><a class="queue-cancel-link" href={`/staff/queues?organization=${encodeURIComponent(data.organization.organizationId)}`}>Cancel</a></div>
						</form>
					{/if}
				</section>
			</div>
		</main>
	</div>
</div>
