<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let initials = $derived(
		data.user.name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('')
	);
</script>

<svelte:head>
	<title>Staff workspace · Kewkew</title>
	<meta name="description" content="Manage your Kewkew staff workspace." />
</svelte:head>

<div class="staff-shell">
	<header class="topbar">
		<a class="brand" href="/staff" aria-label="Kewkew staff workspace">
			<span class="brand-mark" aria-hidden="true">k</span>
			<span class="brand-name">Kewkew<small>Queue, without the wait</small></span>
		</a>
		<div class="staff-header-actions">
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
			<div class="staff-sidebar-card">
				<strong>Getting started</strong>
				<p>Your Kewkew workspace is ready. Queue configuration is the next step.</p>
				<span>Workspace setup</span>
			</div>
		</aside>

		<main class="staff-content">
			<div class="staff-page">
				<header class="staff-page-heading">
					<div>
						<p class="eyebrow">Staff workspace</p>
						<h1>Welcome, {data.user.name.trim().split(/\s+/)[0]}.</h1>
						<p class="staff-page-subhead">Your Kewkew workspace is ready to help your team serve visitors.</p>
					</div>
					<span class="staff-active-pill"><i aria-hidden="true"></i> Signed in</span>
				</header>

				<section class="staff-welcome-card" aria-labelledby="workspace-ready-title">
					<div>
						<p class="eyebrow">You’re all set</p>
						<h2 id="workspace-ready-title">Your workspace is ready for its first queue.</h2>
						<p>Queue setup and service management are coming in the next Kewkew build slice. Your staff sign-in is ready now.</p>
					</div>
					<div class="staff-welcome-mark" aria-hidden="true">
						<span>k</span>
						<i></i><i></i><i></i>
					</div>
				</section>

				<div class="staff-overview-grid">
					<section class="staff-card" aria-labelledby="account-title">
						<div class="staff-card-heading">
							<h2 id="account-title">Your account</h2>
							<span class="staff-card-tag">Active</span>
						</div>
						<div class="staff-account-details">
							<span class="staff-avatar large" aria-hidden="true">{initials}</span>
							<div><strong>{data.user.name}</strong><span>{data.user.email}</span></div>
						</div>
					</section>

					<section class="staff-card queue-next-card" aria-labelledby="queue-next-title">
						<div class="staff-card-heading">
							<h2 id="queue-next-title">Queue operations</h2>
							<span class="coming-soon">Coming next</span>
						</div>
						<p>Queue configuration and live staff operations will appear here as those features are added.</p>
					</section>
				</div>
			</div>
		</main>
	</div>
</div>
