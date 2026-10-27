<script lang="ts">
	import type { PageProps } from './$types';
	import StaffSidebar from '../../../lib/StaffSidebar.svelte';
	let { data }: PageProps = $props();
	let query = $derived(`?organization=${encodeURIComponent(data.organization.id)}`);
</script>

<svelte:head>
	<title>Setup · Kewkew staff workspace</title>
	<meta name="description" content="Configure your Kewkew organization." />
</svelte:head>

<div class="staff-shell">
	<header class="topbar">
		<a class="brand" href="/staff" aria-label="Kewkew staff workspace">
			<span class="brand-mark" aria-hidden="true">k</span>
			<span class="brand-name">Kewkew<small>Queue, without the wait</small></span>
		</a>
		<div class="staff-header-actions">
			{#if data.organizations.length > 1}
				<form class="staff-workspace-switcher" method="GET" action="/staff/setup">
					<label for="setup-organization-switch">Organization</label>
					<select id="setup-organization-switch" name="organization" value={data.organization.id}>
						{#each data.organizations as organization}<option value={organization.id}>{organization.name}</option>{/each}
					</select>
					<button type="submit">Switch</button>
				</form>
			{:else}
				<span class="staff-current-organization">{data.organization.name}</span>
			{/if}
			<a class="staff-signout" href="/staff">Back to workspace</a>
		</div>
	</header>
	<div class="staff-workspace">
		<StaffSidebar organizationId={data.organization.id} organizationRole="admin" locationCount={data.locationCount} active="setup" />
		<main class="staff-content"><div class="staff-page">
			<header class="staff-page-heading">
				<div><p class="eyebrow">Administrator workspace</p><h1>Setup overview</h1><p class="staff-page-subhead">Choose an area to manage {data.organization.name}.</p></div>
			</header>
			<div class="staff-setup-grid">
				<a class="staff-card staff-setup-card" href={`/staff?organization=${encodeURIComponent(data.organization.id)}#organization-profile-title`}>
					<span class="staff-setup-card-icon" aria-hidden="true">⌂</span><strong>Organization</strong><small>Manage organization details</small>
				</a>
				<a class="staff-card staff-setup-card" href={`/staff?organization=${encodeURIComponent(data.organization.id)}#locations-title`}>
					<span class="staff-setup-card-icon" aria-hidden="true">⌖</span><strong>Locations</strong><span>{data.locationCount} {data.locationCount === 1 ? 'location' : 'locations'}</span><small>Manage sites and availability</small>
				</a>
				<a class="staff-card staff-setup-card" href={`/staff?organization=${encodeURIComponent(data.organization.id)}#services-title`}>
					<span class="staff-setup-card-icon" aria-hidden="true">⚒</span><strong>Services</strong><span>{data.serviceCount} {data.serviceCount === 1 ? 'service' : 'services'}</span><small>Manage services across locations</small>
				</a>
				<div class="staff-card staff-setup-card unavailable" aria-disabled="true">
					<span class="staff-setup-card-icon" aria-hidden="true">▤</span><strong>Queues</strong><span>Coming soon</span><small>Queue configuration is not available yet</small>
				</div>
				<a class="staff-card staff-setup-card" href={`/staff/access${query}`}>
					<span class="staff-setup-card-icon" aria-hidden="true">♙</span><strong>Staff access</strong><span>{data.memberCount} {data.memberCount === 1 ? 'member' : 'members'}</span><small>Invite staff and manage access</small>
				</a>
			</div>
		</div></main>
	</div>
</div>

<style>
	.staff-setup-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
	.staff-setup-card { min-height: 174px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 22px; color: var(--ink); text-decoration: none; }
	.staff-setup-card:hover { border-color: #b7cbbd; transform: translateY(-1px); }
	.staff-setup-card strong { font-size: 15px; }
	.staff-setup-card span:not(.staff-setup-card-icon), .staff-setup-card small { color: var(--muted); font-size: 11px; }
	.staff-setup-card small { line-height: 1.5; }
	.staff-setup-card-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; background: var(--mint); color: var(--green); font-size: 18px; }
	.staff-setup-card.unavailable { background: #f6f8f6; box-shadow: none; opacity: .68; }
	@media (max-width: 540px) { .staff-setup-grid { grid-template-columns: 1fr; } }
</style>
