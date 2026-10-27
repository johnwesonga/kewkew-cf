<script lang="ts">
	type Props = {
		organizationId: string | null;
		organizationRole: 'admin' | 'operator' | null;
		locationCount: number;
		active: 'overview' | 'setup' | 'staff';
	};
	let { organizationId, organizationRole, locationCount, active }: Props = $props();
	let isAdmin = $derived(organizationRole === 'admin' && organizationId !== null);
	let query = $derived(organizationId ? `?organization=${encodeURIComponent(organizationId)}` : '');
	let overviewUrl = $derived(`/staff${query}`);
	let setupUrl = $derived(`/staff/setup${query}`);
	let profileUrl = $derived(`${overviewUrl}#organization-profile-title`);
	let locationsUrl = $derived(`${overviewUrl}#locations-title`);
	let servicesUrl = $derived(`${overviewUrl}#services-title`);
	let staffUrl = $derived(`/staff/access${query}`);
</script>

<aside class="staff-sidebar">
	<p class="staff-sidebar-label">Workspace</p>
	<nav class="staff-nav-list" aria-label="Staff workspace">
		<a class:active={active === 'overview'} class="staff-nav-link" href={overviewUrl} aria-current={active === 'overview' ? 'page' : undefined}>
			<span class="staff-nav-icon" aria-hidden="true">▦</span> Overview
		</a>
		{#if isAdmin}
			<a class:active={active !== 'overview'} class="staff-nav-link" href={setupUrl} aria-current={active === 'setup' ? 'page' : undefined}>
				<span class="staff-nav-icon" aria-hidden="true">⚙</span> Setup
			</a>
			<div class="staff-nav-subnav" role="group" aria-label="Setup pages">
				<a href={profileUrl}>Organization</a>
				<a href={locationsUrl}>Locations</a>
				<a href={servicesUrl}>Services</a>
				<span class="staff-nav-link disabled" aria-disabled="true">Queues <small>Coming soon</small></span>
				<a class:active={active === 'staff'} href={staffUrl} aria-current={active === 'staff' ? 'page' : undefined}>Staff access</a>
			</div>
		{/if}
	</nav>
	{#if organizationRole}
		<div class="staff-sidebar-card">
			<strong>Your access</strong>
			<p>{organizationRole === 'admin' ? 'Organization administrator' : 'Assigned locations only'}</p>
			<span>{locationCount} {locationCount === 1 ? 'location' : 'locations'}</span>
		</div>
	{/if}
</aside>
