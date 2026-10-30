<script lang="ts">
	import StaffSidebar from "#lib/StaffSidebar.svelte";
	import type { PageProps } from "./$types";
	let { data }: PageProps = $props();
	let initials = $derived(
		data.user.name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join(""),
	);
	let organizationQuery = $derived(
		`?organization=${encodeURIComponent(data.organization.organizationId)}`,
	);
</script>

<svelte:head>
	<title>Live queues · {data.organization.organizationName} · Kewkew</title>
	<meta
		name="description"
		content="Open operational boards for queues assigned to your staff role."
	/>
</svelte:head>

<div class="staff-shell">
	<header class="topbar">
		<a class="brand" href="/staff/live" aria-label="Kewkew staff workspace">
			<span class="brand-mark" aria-hidden="true">k</span>
			<span class="brand-name"
				>Kewkew<small>Queue, without the wait</small></span
			>
		</a>
		<div class="staff-header-actions">
			{#if data.organizations.length > 1}
				<form
					class="staff-workspace-switcher"
					method="GET"
					action="/staff/live"
				>
					<label for="live-organization-switch">Organization</label>
					<select
						id="live-organization-switch"
						name="organization"
						value={data.organization.organizationId}
					>
						{#each data.organizations as organization}<option
								value={organization.organizationId}
								>{organization.organizationName}</option
							>{/each}
					</select>
					<button type="submit">Switch</button>
				</form>
			{:else}
				<span class="staff-current-organization"
					>{data.organization.organizationName}</span
				>
			{/if}
			<div class="staff-account-chip">
				<span class="staff-avatar" aria-hidden="true">{initials}</span>
				<span class="staff-account-copy"
					><strong>{data.user.name}</strong><small
						>{data.user.email}</small
					></span
				>
			</div>
			<form method="POST" action="/staff?/signOut">
				<button class="staff-signout" type="submit">Sign out</button>
			</form>
		</div>
	</header>

	<div class="staff-workspace">
		<StaffSidebar
			organizationId={data.organization.organizationId}
			organizationRole={data.organization.role}
			locationCount={data.locationCount}
			active="live"
		/>
		<main class="staff-content">
			<div class="staff-page">
				<header class="staff-page-heading">
					<div>
						<p class="eyebrow">Queue operations</p>
						<h1>Live queues</h1>
						<p class="staff-page-subhead">
							Choose a queue to monitor visitors and perform
							ticket actions for {data.organization
								.organizationName}.
						</p>
					</div>
					<span class="staff-active-pill"
						><i aria-hidden="true"></i>{data.queues.length}
						{data.queues.length === 1 ? "queue" : "queues"}</span
					>
				</header>
				{#if data.opened}<p
						class="staff-feedback success-message"
						role="status"
					>
						Session opened.
					</p>{/if}
				{#if data.sessionUpdated === "paused"}<p
						class="staff-feedback success-message"
						role="status"
					>
						Session paused. Visitors can no longer join.
					</p>{/if}
				{#if data.sessionUpdated === "open"}<p
						class="staff-feedback success-message"
						role="status"
					>
						Session resumed. Visitors can join again.
					</p>{/if}
				{#if data.sessionUpdated === "closed"}<p
						class="staff-feedback success-message"
						role="status"
					>
						Session closed. Its history is preserved.
					</p>{/if}
				{#if data.sessionUnchanged}<p
						class="staff-feedback success-message"
						role="status"
					>
						The session was already in that state.
					</p>{/if}

				{#if data.queues.length === 0}
					<section class="staff-card queue-board-empty" role="status">
						<p class="eyebrow">Queue operations</p>
						<h2>No queues are available</h2>
						<p>
							Queues assigned to your role will appear here when
							they are configured.
						</p>
					</section>
				{:else}
					<section
						class="staff-card queues-card"
						aria-labelledby="live-queue-list-title"
					>
						<div class="staff-card-heading">
							<div>
								<h2 id="live-queue-list-title">
									Queues you can operate
								</h2>
							</div>
						</div>
						<div class="queue-table-wrap">
							<table class="queue-table">
								<thead
									><tr
										><th scope="col">Queue</th><th
											scope="col">Location</th
										><th scope="col">Service</th><th
											scope="col">Session</th
										><th scope="col">Actions</th></tr
									></thead
								>
								<tbody>
									{#each data.queues as queue (queue.id)}
										<tr>
											<th scope="row"
												>{queue.name}<small
													class="queue-live-state"
													>{queue.isActive === 1
														? "Active queue"
														: "Inactive queue"}</small
												></th
											>
											<td>{queue.locationName}</td>
											<td>{queue.serviceName}</td>
											<td
												>{queue.sessionState
													? queue.sessionState[0]!.toUpperCase() +
														queue.sessionState.slice(
															1,
														)
													: "No open session"}</td
											>
											<td
												><div class="queue-row-actions">
													<a
														class="queue-edit-link"
														href={`/staff/queues/${encodeURIComponent(queue.id)}/board${organizationQuery}`}
														>Open live board</a
													>
													{#if queue.sessionId && queue.transitionRequestId && (queue.sessionState === "open" || queue.sessionState === "paused")}
														<form
															method="POST"
															action={`/staff/queues?/changeSessionState&organization=${encodeURIComponent(data.organization.organizationId)}`}
														>
															<input
																type="hidden"
																name="queueId"
																value={queue.id}
															/>
															<input
																type="hidden"
																name="sessionId"
																value={queue.sessionId}
															/>
															<input
																type="hidden"
																name="requestId"
																value={queue.transitionRequestId}
															/>
															<input
																type="hidden"
																name="returnTo"
																value="/staff/live"
															/>
															<button
																class="queue-edit-link"
																type="submit"
																name="transition"
																value={queue.sessionState ===
																"open"
																	? "pause"
																	: "resume"}
																>{queue.sessionState ===
																"open"
																	? "Pause"
																	: "Resume"}</button
															>
															<button
																class="queue-edit-link"
																type="submit"
																name="transition"
																value="close"
																>Close session</button
															>
														</form>
													{/if}
													{#if queue.sessionState === null && queue.isActive === 1 && queue.locationIsActive === 1 && queue.serviceIsActive === 1}
														<form
															method="POST"
															action={`/staff/queues?/openSession&organization=${encodeURIComponent(data.organization.organizationId)}`}
														>
															<input
																type="hidden"
																name="queueId"
																value={queue.id}
															/>
															<input
																type="hidden"
																name="openRequestId"
																value={queue.openRequestId}
															/>
															<input
																type="hidden"
																name="returnTo"
																value="/staff/live"
															/>
															<button
																class="queue-edit-link"
																type="submit"
																>Open session</button
															>
														</form>
													{/if}
													{#if queue.sessionState === null && (queue.isActive !== 1 || queue.locationIsActive !== 1 || queue.serviceIsActive !== 1)}
														<small
															class="queue-live-state"
															>Activate the queue,
															location, and
															service in Setup
															before opening a
															session.</small
														>
													{/if}
												</div></td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>
				{/if}
			</div>
		</main>
	</div>
</div>

<style>
	.queue-live-state {
		display: block;
		margin-top: 4px;
		color: var(--muted);
		font-weight: 400;
	}
	.queue-row-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.queue-row-actions form {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
