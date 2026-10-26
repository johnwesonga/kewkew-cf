<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let initials = $derived(
		data.user.name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('')
	);
	let firstName = $derived(data.user.name.trim().split(/\s+/)[0] ?? 'there');
</script>

<svelte:head>
	<title>Staff workspace · Kewkew</title>
	<meta name="description" content="Manage your Kewkew organization and locations." />
</svelte:head>

<div class="staff-shell">
	<header class="topbar">
		<a class="brand" href="/staff" aria-label="Kewkew staff workspace">
			<span class="brand-mark" aria-hidden="true">k</span>
			<span class="brand-name">Kewkew<small>Queue, without the wait</small></span>
		</a>
		<div class="staff-header-actions">
			{#if data.organization && data.organizations.length > 1}
				<form class="staff-workspace-switcher" method="GET" action="/staff">
					<label for="organization-switch">Organization</label>
					<select
						id="organization-switch"
						name="organization"
						value={data.organization.organizationId}
					>
						{#each data.organizations as organization}
							<option value={organization.organizationId}>{organization.organizationName}</option>
						{/each}
					</select>
					<button type="submit">Switch</button>
				</form>
			{:else if data.organization}
				<span class="staff-current-organization">{data.organization.organizationName}</span>
			{/if}
			<div class="staff-account-chip">
				<span class="staff-avatar" aria-hidden="true">{initials}</span>
				<span class="staff-account-copy"><strong>{data.user.name}</strong><small>{data.user.email}</small></span>
			</div>
			<form method="POST" action="?/signOut">
				<button class="staff-signout" type="submit">Sign out</button>
			</form>
		</div>
	</header>

	<div class="staff-workspace">
		<aside class="staff-sidebar">
			<p class="staff-sidebar-label">Workspace</p>
			<nav class="staff-nav-list" aria-label="Staff workspace">
				<a class="staff-nav-link active" href="/staff" aria-current="page">
					<span class="staff-nav-icon" aria-hidden="true">▦</span> Overview
				</a>
			</nav>
			{#if data.organization}
				<div class="staff-sidebar-card">
					<strong>Your access</strong>
					<p>{data.organization.role === 'admin' ? 'Organization administrator' : 'Assigned locations only'}</p>
					<span>{data.locations.length} {data.locations.length === 1 ? 'location' : 'locations'}</span>
				</div>
			{/if}
		</aside>

		<main class="staff-content">
			<div class="staff-page">
				{#if !data.organization}
					<section class="staff-access-empty" aria-labelledby="access-title">
						<span class="staff-empty-mark" aria-hidden="true">!</span>
						<p class="eyebrow">Workspace access</p>
						<h1 id="access-title">No active organization access</h1>
						<p>Your account is signed in, but it doesn’t currently have an active organization membership. Contact an organization administrator for access.</p>
					</section>
				{:else}
					<header class="staff-page-heading">
						<div>
							<p class="eyebrow">{data.organization.role === 'admin' ? 'Organization administrator' : 'Operator workspace'}</p>
							<h1>{data.organization.organizationName}</h1>
							<p class="staff-page-subhead">Welcome, {firstName}. Here’s your organization overview.</p>
						</div>
						<span class="staff-active-pill"><i aria-hidden="true"></i> Membership active</span>
					</header>

					<section class="staff-welcome-card" aria-labelledby="workspace-ready-title">
						<div>
							<p class="eyebrow">Organization overview</p>
							<h2 id="workspace-ready-title">Your team’s Kewkew workspace.</h2>
							<p>Organization details and the locations available to your role are shown below.</p>
						</div>
						<div class="staff-welcome-mark" aria-hidden="true">
							<span>k</span>
							<i></i><i></i><i></i>
						</div>
					</section>

					<div class="staff-overview-grid">
						<section class="staff-card organization-profile-card" aria-labelledby="organization-profile-title">
							<div class="staff-card-heading">
								<h2 id="organization-profile-title">Organization profile</h2>
								<span class="staff-card-tag">{data.organization.role === 'admin' ? 'Admin access' : 'View only'}</span>
							</div>
							{#if data.organization.role === 'admin'}
								<form
									class="organization-name-form"
									method="POST"
									action={`?/updateOrganization&organization=${encodeURIComponent(data.organization.organizationId)}`}
								>
									<label for="organization-name">Organization name</label>
									<div class="organization-name-controls">
										<input
											id="organization-name"
											name="organizationName"
											value={data.organization.organizationName}
											maxlength="160"
											required
										/>
										<button type="submit">Save changes</button>
									</div>
									{#if form?.message}<p class="staff-form-message error-message" role="alert">{form.message}</p>{/if}
									{#if form?.success}<p class="staff-form-message success-message" role="status">{form.success}</p>{/if}
								</form>
							{:else}
								<dl class="organization-readonly">
									<div><dt>Organization name</dt><dd>{data.organization.organizationName}</dd></div>
								</dl>
								<p class="read-only-note">Only an organization administrator can change this name.</p>
							{/if}
						</section>

						<section class="staff-card locations-card" aria-labelledby="locations-title">
							<div class="staff-card-heading">
								<h2 id="locations-title">{data.organization.role === 'admin' ? 'Organization locations' : 'Your assigned locations'}</h2>
								<span class="staff-card-tag">{data.locations.length} {data.locations.length === 1 ? 'location' : 'locations'}</span>
							</div>
							{#if data.locations.length > 0}
								<ul class="staff-location-list">
									{#each data.locations as location}
										<li>
											<span class="location-symbol" aria-hidden="true">⌖</span>
											<span class="location-copy"><strong>{location.name}</strong><small>{location.timezone}</small></span>
											<span class:inactive={location.isActive === 0} class="location-status">
												{location.isActive === 1 ? 'Active' : 'Inactive'}
											</span>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="staff-empty-copy">
									{data.organization.role === 'admin'
										? 'There are no locations in this organization yet.'
										: 'No locations have been assigned to your account yet.'}
								</p>
							{/if}
						</section>
					</div>

					<section class="staff-card staff-account-card" aria-labelledby="account-title">
						<div class="staff-card-heading">
							<h2 id="account-title">Your account</h2>
							<span class="staff-card-tag">{data.organization.role === 'admin' ? 'Administrator' : 'Operator'}</span>
						</div>
						<div class="staff-account-details">
							<span class="staff-avatar large" aria-hidden="true">{initials}</span>
							<div><strong>{data.user.name}</strong><span>{data.user.email}</span></div>
						</div>
					</section>
				{/if}
			</div>
		</main>
	</div>
</div>
