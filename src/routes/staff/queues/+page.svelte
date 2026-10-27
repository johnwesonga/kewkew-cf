<script lang="ts">
	import StaffSidebar from '../../../lib/StaffSidebar.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let locationFilter = $state('all');
	let serviceFilter = $state('all');
	let stateFilter = $state('all');
	let filteredQueues = $derived(data.queues.filter((queue) =>
		(locationFilter === 'all' || queue.locationId === locationFilter)
		&& (serviceFilter === 'all' || queue.serviceId === serviceFilter)
		&& (stateFilter === 'all' || (stateFilter === 'active' ? queue.isActive === 1 : queue.isActive === 0))
	));
	let locations = $derived([...new Map(data.queues.map((queue) => [queue.locationId, queue.locationName])).entries()]);
	let services = $derived([...new Map(data.queues.map((queue) => [queue.serviceId, queue.serviceName])).entries()].sort((a, b) => a[1].localeCompare(b[1])));
	let initials = $derived(data.user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join(''));
</script>

<svelte:head>
	<title>Queues · {data.organization.organizationName} · Kewkew</title>
	<meta name="description" content="View queues and their current operating state." />
</svelte:head>

<div class="staff-shell">
	<header class="topbar">
		<a class="brand" href="/staff" aria-label="Kewkew staff workspace">
			<span class="brand-mark" aria-hidden="true">k</span>
			<span class="brand-name">Kewkew<small>Queue, without the wait</small></span>
		</a>
		<div class="staff-header-actions">
			{#if data.organizations.length > 1}
				<form class="staff-workspace-switcher" method="GET" action="/staff/queues">
					<label for="organization-switch">Organization</label>
					<select id="organization-switch" name="organization" value={data.organization.organizationId}>
						{#each data.organizations as organization}
							<option value={organization.organizationId}>{organization.organizationName}</option>
						{/each}
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
				<header class="staff-page-heading">
					<div>
						<p class="eyebrow">{data.organization.role === 'admin' ? 'Queue configuration' : 'Operator workspace'}</p>
						<h1>Queues</h1>
						<p class="staff-page-subhead">Review queue setup and current session state for {data.organization.organizationName}.</p>
					</div>
					<span class="staff-active-pill"><i aria-hidden="true"></i>{data.queues.length} {data.queues.length === 1 ? 'queue' : 'queues'}</span>
				</header>

				{#if data.queues.length > 0}
					<section class="staff-card queues-card" aria-labelledby="queue-list-title">
						<div class="staff-card-heading">
							<h2 id="queue-list-title">Queue list</h2>
							<span class="staff-card-tag">{filteredQueues.length} shown</span>
						</div>
						<div class="queue-filters">
							<label>Location
								<select bind:value={locationFilter}>
									<option value="all">All locations</option>
									{#each locations as [id, name]}<option value={id}>{name}</option>{/each}
								</select>
							</label>
							<label>Service
								<select bind:value={serviceFilter}>
									<option value="all">All services</option>
									{#each services as [id, name]}<option value={id}>{name}</option>{/each}
								</select>
							</label>
							<label>Queue status
								<select bind:value={stateFilter}>
									<option value="all">All statuses</option>
									<option value="active">Active</option>
									<option value="inactive">Inactive</option>
								</select>
							</label>
						</div>
						{#if filteredQueues.length > 0}
							<div class="queue-table-wrap">
								<table class="queue-table">
									<thead><tr><th scope="col">Queue</th><th scope="col">Location</th><th scope="col">Service</th><th scope="col">Queue status</th><th scope="col">Session</th><th scope="col">Active ticket capacity</th></tr></thead>
									<tbody>
										{#each filteredQueues as queue (queue.id)}
											<tr>
												<th scope="row">{queue.name}</th>
												<td>{queue.locationName}</td>
												<td>{queue.serviceName}</td>
												<td><span class="location-status" class:inactive={queue.isActive === 0}>{queue.isActive === 1 ? 'Active' : 'Inactive'}</span></td>
												<td>{queue.sessionState ? queue.sessionState[0]!.toUpperCase() + queue.sessionState.slice(1) : 'No open session'}</td>
												<td>{queue.activeTicketCapacity ?? 'Unlimited'}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<p class="queue-filter-empty" role="status">No queues match these filters.</p>
						{/if}
					</section>
				{:else}
					<section class="staff-card queue-empty" aria-labelledby="queue-empty-title">
						<p class="eyebrow">Queue configuration</p>
						<h2 id="queue-empty-title">No queues yet</h2>
						<p>Queues for your {data.organization.role === 'admin' ? 'organization' : 'assigned locations'} will appear here when they have been configured.</p>
					</section>
				{/if}
			</div>
		</main>
	</div>
</div>
