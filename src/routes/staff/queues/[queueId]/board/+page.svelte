<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { onMount } from "svelte";
	import StaffSidebar from "#lib/StaffSidebar.svelte";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();
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

	onMount(() => {
		const interval = window.setInterval(() => void invalidateAll(), 10_000);
		return () => window.clearInterval(interval);
	});
</script>

<svelte:head>
	<title>{data.queue.name} · Live queue · Kewkew</title>
	<meta
		name="description"
		content="Monitor visitors in the active queue session."
	/>
</svelte:head>

<div class="staff-shell">
	<header class="topbar">
		<a class="brand" href="/staff" aria-label="Kewkew staff workspace">
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
					action={`/staff/queues/${encodeURIComponent(data.queue.id)}/board`}
				>
					<label for="organization-switch">Organization</label>
					<select
						id="organization-switch"
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
				<a
					class="queue-back-link"
					 href={`/staff/live${organizationQuery}`}
					>← Back to live queues</a
				>
				<header class="staff-page-heading">
					<div>
						<p class="eyebrow">Live queue</p>
						<h1>{data.queue.name}</h1>
						<p class="staff-page-subhead">
							{data.queue.locationName} · {data.queue.serviceName}
						</p>
					</div>
					<div class="queue-board-controls">
						<span
							class="queue-board-session"
							class:paused={data.sessionState === "paused"}
							class:closed={data.sessionState === "closed"}
						>
							{data.sessionState
								? data.sessionState[0]!.toUpperCase() +
									data.sessionState.slice(1)
								: "No session"}
						</span>
						{#if data.sessionId && data.callRequestId}
							<form
								class="queue-board-call-form"
								method="POST"
								action={`?/callNext&organization=${encodeURIComponent(data.organization.organizationId)}`}
							>
								<input
									type="hidden"
									name="sessionId"
									value={data.sessionId}
								/>
								<input
									type="hidden"
									name="requestId"
									value={data.callRequestId}
								/>
								<button
									class="queue-create-submit"
									type="submit"
									disabled={!data.canCallNext}
									>Call next visitor</button
								>
							</form>
						{/if}
						<button
							class="queue-edit-link"
							type="button"
							onclick={() => invalidateAll()}>Refresh</button
						>
						{#if data.organization.role === "admin"}
							<a
								class="queue-edit-link"
								href={`/staff/queues/${encodeURIComponent(data.queue.id)}${organizationQuery}`}
								>Edit queue</a
							>
						{/if}
					</div>
				</header>
				{#if form?.message}<p
						class="staff-feedback error-message"
						role="alert"
					>
						{form.message}
					</p>{/if}
				{#if data.calledTicket}<p
						class="staff-feedback success-message"
						role="status"
					>
						{data.replayedCall
							? "This call was already processed."
							: "Called ticket"} #{data.calledTicket}.
					</p>{/if}
				{#if data.startedTicket}<p
						class="staff-feedback success-message"
						role="status"
					>
						{data.replayedStart
							? "Start-serving request already processed for ticket"
							: "Service started for ticket"} #{data.startedTicket}.
					</p>{/if}
				{#if data.completedTicket}<p
						class="staff-feedback success-message"
						role="status"
					>
						{data.replayedCompletion
							? "Completion request already processed for ticket"
							: "Service completed for ticket"} #{data.completedTicket}. The ticket has left the active queue.
					</p>{/if}
				{#if data.skippedTicket}<p
						class="staff-feedback success-message"
						role="status"
					>
						{data.replayedSkip
							? "Skip request already processed for ticket"
							: "Ticket marked as no-show"} #{data.skippedTicket}. The ticket has left the active queue.
					</p>{/if}
				{#if data.recalledTicket}<p
						class="staff-feedback success-message"
						role="status"
					>
						{data.replayedRecall
							? "Recall request already processed for ticket"
							: "Ticket requeued at the end of the line"} #{data.recalledTicket}.
					</p>{/if}
				{#if data.sessionId && !data.canCallNext}<p
						class="queue-board-action-hint"
					>
						Nobody is waiting; there is no visitor to call.
					</p>{/if}

				{#if data.tickets.length === 0}
					<section class="staff-card queue-board-empty" role="status">
						<p class="eyebrow">Queue status</p>
						<h2>{data.emptyMessage}</h2>
						{#if data.sessionState === "paused"}<p>
								Resume the session from the queue list when
								visitors can join again.
							</p>{/if}
					</section>
				{:else}
					<section
						class="staff-card queue-board-card"
						aria-labelledby="queue-board-title"
					>
						<div class="staff-card-heading">
							<div>
								<h2 id="queue-board-title">Active visitors</h2>
								<p>
									Tickets are shown in queue order. This board
									refreshes every 10 seconds.
								</p>
							</div>
							<span class="staff-card-tag"
								>{data.tickets.length} active</span
							>
						</div>
						<ol class="queue-board-list">
							{#each data.tickets as ticket (ticket.id)}
								<li class="queue-board-ticket">
									<span class="queue-board-number"
										>{ticket.ticketNumber}</span
									>
									<div class="queue-board-visitor">
										<strong
											>{ticket.firstName
												? `${ticket.firstName} ${ticket.lastName ?? ""}`.trim()
												: `Ticket #${ticket.ticketNumber}`}</strong
										>
										<small
											>Queue sequence {ticket.queueSequence}</small
										>
									</div>
									<span
										class="queue-board-status"
										class:called={ticket.status ===
											"called"}
										class:serving={ticket.status ===
											"serving"}
										>{ticket.status.replace("_", " ")}</span
									>
									{#if ticket.canStartServing && ticket.startRequestId && data.sessionId}
										<form
											method="POST"
											action={`?/startServing&organization=${encodeURIComponent(data.organization.organizationId)}`}
										>
											<input
												type="hidden"
												name="sessionId"
												value={data.sessionId}
											/>
											<input
												type="hidden"
												name="ticketId"
												value={ticket.id}
											/>
											<input
												type="hidden"
												name="requestId"
												value={ticket.startRequestId}
											/>
											<button
												class="queue-edit-link"
												type="submit"
												>Start serving</button
											>
										</form>
									{/if}
								{#if ticket.canSkip && ticket.skipRequestId && data.sessionId}
									<form
									method="POST"
									action={`?/skipTicket&organization=${encodeURIComponent(data.organization.organizationId)}`}
								>
									<input type="hidden" name="sessionId" value={data.sessionId} />
									<input type="hidden" name="ticketId" value={ticket.id} />
									<input type="hidden" name="requestId" value={ticket.skipRequestId} />
									<button class="queue-edit-link" type="submit">Skip · no response</button>
								</form>
								{/if}
									{#if ticket.canCompleteService && ticket.completeRequestId && data.sessionId}
										<form
										method="POST"
										action={`?/completeService&organization=${encodeURIComponent(data.organization.organizationId)}`}
									>
										<input type="hidden" name="sessionId" value={data.sessionId} />
										<input type="hidden" name="ticketId" value={ticket.id} />
										<input type="hidden" name="requestId" value={ticket.completeRequestId} />
										<button class="queue-edit-link" type="submit">Complete service</button>
									</form>
									{/if}
								</li>
							{/each}
						</ol>
					</section>
				{/if}
				{#if data.noShowTickets.length > 0}
					<section class="staff-card queue-board-card" aria-labelledby="no-show-title">
						<div class="staff-card-heading">
							<div>
								<h2 id="no-show-title">No-show visitors</h2>
								<p>Requeue a visitor when they return. They will join behind everyone already waiting.</p>
							</div>
						</div>
						<ul class="queue-board-list">
							{#each data.noShowTickets as ticket (ticket.id)}
								<li class="queue-board-ticket">
									<span class="queue-board-number">{ticket.ticketNumber}</span>
									<div class="queue-board-visitor">
										<strong>{ticket.firstName ? `${ticket.firstName} ${ticket.lastName ?? ""}`.trim() : `Ticket #${ticket.ticketNumber}`}</strong>
										<small>No-show</small>
									</div>
									<span class="queue-board-status">no-show</span>
									{#if ticket.canRecall && ticket.recallRequestId && data.sessionId}
										<form method="POST" action={`?/recallTicket&organization=${encodeURIComponent(data.organization.organizationId)}`}>
											<input type="hidden" name="sessionId" value={data.sessionId} />
											<input type="hidden" name="ticketId" value={ticket.id} />
											<input type="hidden" name="requestId" value={ticket.recallRequestId} />
											<button class="queue-edit-link" type="submit">Requeue visitor</button>
										</form>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			</div>
		</main>
	</div>
</div>

<style>
	.queue-board-call-form {
		margin: 0;
	}
	.queue-board-call-form button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.queue-board-action-hint {
		margin: -12px 0 18px;
		color: var(--muted);
		font-size: 12px;
	}
	.queue-board-ticket form {
		margin: 0;
	}
</style>
