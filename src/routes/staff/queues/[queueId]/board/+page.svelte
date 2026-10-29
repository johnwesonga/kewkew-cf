<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import StaffSidebar from '#lib/StaffSidebar.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let initials = $derived(data.user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join(''));
	let organizationQuery = $derived(`?organization=${encodeURIComponent(data.organization.organizationId)}`);

	onMount(() => {
		const interval = window.setInterval(() => void invalidateAll(), 10_000);
		return () => window.clearInterval(interval);
	});
</script>

<svelte:head>
	<title>{data.queue.name} · Live queue · Kewkew</title>
	<meta name="description" content="Monitor visitors in the active queue session." />
</svelte:head>

<div class="staff-shell">
	<header class="topbar">
		<a class="brand" href="/staff" aria-label="Kewkew staff workspace">
			<span class="brand-mark" aria-hidden="true">k</span>
			<span class="brand-name">Kewkew<small>Queue, without the wait</small></span>
		</a>
		<div class="staff-header-actions">
			{#if data.organizations.length > 1}
				<form class="staff-workspace-switcher" method="GET" action={`/staff/queues/${encodeURIComponent(data.queue.id)}/board`}>
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
		<StaffSidebar organizationId={data.organization.organizationId} organizationRole={data.organization.role} locationCount={data.locationCount} active="queues" />
		<main class="staff-content">
			<div class="staff-page">
				<a class="queue-back-link" href={`/staff/queues${organizationQuery}`}>← Back to queues</a>
				<header class="staff-page-heading">
					<div>
						<p class="eyebrow">Live queue</p>
						<h1>{data.queue.name}</h1>
						<p class="staff-page-subhead">{data.queue.locationName} · {data.queue.serviceName}</p>
					</div>
					<div class="queue-board-controls">
						<span class="queue-board-session" class:paused={data.sessionState === 'paused'} class:closed={data.sessionState === 'closed'}>
							{data.sessionState ? data.sessionState[0]!.toUpperCase() + data.sessionState.slice(1) : 'No session'}
						</span>
						<button class="queue-edit-link" type="button" onclick={() => invalidateAll()}>Refresh</button>
						{#if data.organization.role === 'admin'}
							<a class="queue-edit-link" href={`/staff/queues/${encodeURIComponent(data.queue.id)}${organizationQuery}`}>Edit queue</a>
						{/if}
					</div>
				</header>

				{#if data.tickets.length === 0}
					<section class="staff-card queue-board-empty" role="status">
						<p class="eyebrow">Queue status</p>
						<h2>{data.emptyMessage}</h2>
						{#if data.sessionState === 'paused'}<p>Resume the session from the queue list when visitors can join again.</p>{/if}
					</section>
				{:else}
					<section class="staff-card queue-board-card" aria-labelledby="queue-board-title">
						<div class="staff-card-heading">
							<div><h2 id="queue-board-title">Active visitors</h2><p>Tickets are shown in queue order. This board refreshes every 10 seconds.</p></div>
							<span class="staff-card-tag">{data.tickets.length} active</span>
						</div>
						<ol class="queue-board-list">
							{#each data.tickets as ticket (ticket.id)}
								<li class="queue-board-ticket">
									<span class="queue-board-number">{ticket.ticketNumber}</span>
									<div class="queue-board-visitor">
										<strong>{ticket.firstName ? `${ticket.firstName} ${ticket.lastName ?? ''}`.trim() : `Ticket ${ticket.ticketNumber}`}</strong>
										<small>Queue sequence {ticket.queueSequence}</small>
									</div>
									<span class="queue-board-status" class:called={ticket.status === 'called'} class:serving={ticket.status === 'serving'}>{ticket.status.replace('_', ' ')}</span>
								</li>
							{/each}
						</ol>
					</section>
				{/if}
			</div>
		</main>
	</div>
</div>
