<script lang="ts">
	import StaffSidebar from "#lib/StaffSidebar.svelte";
	import QueueShareLink from "#lib/QueueShareLink.svelte";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();
	let locationFilter = $state("all");
	let serviceFilter = $state("all");
	let stateFilter = $state("all");
	let selectedLocationId = $state("");
	let selectedServiceId = $state("");
	$effect(() => {
		const locationId =
			form?.locationId ?? data.queueLocations[0]?.id ?? "";
		const serviceId = form?.serviceId ?? "";
		const service = data.queueServices.find((entry) => entry.id === serviceId);
		selectedLocationId = locationId;
		selectedServiceId = service && service.locationId !== locationId ? "" : serviceId;
	});
	function handleLocationChange(event: Event) {
		selectedLocationId = (event.currentTarget as HTMLSelectElement).value;
		const selectedService = data.queueServices.find(
			(service) => service.id === selectedServiceId,
		);
		if (
			selectedService &&
			selectedService.locationId !== selectedLocationId
		)
			selectedServiceId = "";
	}
	let filteredQueues = $derived(
		data.queues.filter(
			(queue) =>
				(locationFilter === "all" ||
					queue.locationId === locationFilter) &&
				(serviceFilter === "all" ||
					queue.serviceId === serviceFilter) &&
				(stateFilter === "all" ||
					(stateFilter === "active"
						? queue.isActive === 1
						: queue.isActive === 0)),
		),
	);
	let locations = $derived([
		...new Map(
			data.queues.map((queue) => [queue.locationId, queue.locationName]),
		).entries(),
	]);
	let services = $derived(
		[
			...new Map(
				data.queues.map((queue) => [
					queue.serviceId,
					queue.serviceName,
				]),
			).entries(),
		].sort((a, b) => a[1].localeCompare(b[1])),
	);
	let createServices = $derived(
		data.queueServices.filter(
			(service) => service.locationId === selectedLocationId,
		),
	);
	let initials = $derived(
		data.user.name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join(""),
	);
</script>

<svelte:head>
	<title>Queues · {data.organization.organizationName} · Kewkew</title>
	<meta
		name="description"
		content="View queues and their current operating state."
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
					action="/staff/queues"
				>
					<label for="organization-switch">Organization</label>
					<select
						id="organization-switch"
						name="organization"
						value={data.organization.organizationId}
					>
						{#each data.organizations as organization}
							<option value={organization.organizationId}
								>{organization.organizationName}</option
							>
						{/each}
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
			active="queues"
		/>
		<main class="staff-content">
			<div class="staff-page">
				<header class="staff-page-heading">
					<div>
						<p class="eyebrow">
							{data.organization.role === "admin"
								? "Queue configuration"
								: "Operator workspace"}
						</p>
						<h1>Queues</h1>
						<p class="staff-page-subhead">
							Review queue setup and current session state for {data
								.organization.organizationName}.
						</p>
					</div>
					<span class="staff-active-pill"
						><i aria-hidden="true"></i>{data.queues.length}
						{data.queues.length === 1 ? "queue" : "queues"}</span
					>
				</header>
				{#if data.created}<p
						class="staff-feedback success-message"
						role="status"
					>
						Queue created. It is inactive until an administrator
						activates it.
					</p>{/if}
				{#if data.updated}<p
						class="staff-feedback success-message"
						role="status"
					>
						Queue configuration updated.
					</p>{/if}
				{#if data.opened}<p class="staff-feedback success-message" role="status">Session opened. Ticket numbering starts at 1 for this session.</p>{/if}
				{#if data.sessionUpdated === "paused"}<p class="staff-feedback success-message" role="status">Session paused. Visitors can no longer join this session.</p>{/if}
				{#if data.sessionUpdated === "open"}<p class="staff-feedback success-message" role="status">Session resumed. Visitors can join again.</p>{/if}
				{#if data.sessionUpdated === "closed"}<p class="staff-feedback success-message" role="status">Session closed. Its history is preserved; a new session can now be opened.</p>{/if}
				{#if data.sessionUnchanged}<p class="staff-feedback success-message" role="status">The session was already in that state; no duplicate transition was recorded.</p>{/if}
				{#if form?.message}<p
						class="staff-feedback error-message"
						role="alert"
					>
						{form.message}
					</p>{/if}

				{#if data.organization.role === "admin"}
					<section
						class="staff-card queue-create-card"
						aria-labelledby="queue-create-title"
					>
						<div class="staff-card-heading">
							<div>
								<p class="eyebrow">Queue setup</p>
								<h2 id="queue-create-title">Create a queue</h2>
							</div>
							<span class="staff-card-tag">Starts inactive</span>
						</div>
						{#if data.queueLocations.length === 0}
							<p class="queue-filter-empty">
								Add a location before creating a queue.
							</p>
						{:else if data.queueServices.length === 0}
							<p class="queue-filter-empty">
								Add a service to a location before creating a
								queue.
							</p>
						{:else}
							<form
								class="queue-create-form"
								method="POST"
								action={`?/createQueue&organization=${encodeURIComponent(data.organization.organizationId)}`}
							>
								<input
									type="hidden"
									name="createRequestId"
									value={form?.createRequestId ??
										data.createRequestId ??
										""}
								/>
								<label
									>Queue name
									<input
										name="queueName"
										maxlength="160"
										required
										value={form?.queueName ?? ""}
										autocomplete="off"
									/>
								</label>
								<div class="queue-create-row">
									<label
										>Location
										<select
											name="locationId"
											bind:value={selectedLocationId}
							onchange={handleLocationChange}
											required
										>
											<option value="" disabled
												>Choose a location</option
											>
											{#each data.queueLocations as location}
												<option value={location.id}
													>{location.name}{location.isActive ===
													0
														? " · Inactive"
														: ""}</option
												>
											{/each}
										</select>
									</label>
									<label
										>Service
										<select
											name="serviceId"
											required
											bind:value={selectedServiceId}
										>
											<option value="" disabled
												>Choose a service</option
											>
											{#each createServices as service}
												<option value={service.id}
													>{service.name}{service.isActive ===
													0
														? " · Inactive"
														: ""}</option
												>
											{/each}
										</select>
										{#if createServices.length === 0}<span
												class="queue-label-hint"
												>No services are configured for
												this location. Choose another
												location or add a service first.</span
											>{/if}
									</label>
								</div>
								<div class="queue-create-row">
									<label
										>Visitor identity
										<select
											name="identityPolicy"
											required
											value={form?.identityPolicy ??
												"anonymous"}
										>
											<option value="anonymous"
												>Anonymous tickets</option
											>
											<option value="name_required"
												>Require first and last name</option
											>
										</select>
									</label>
									<label
										>Active ticket capacity
										<input
											type="number"
											name="activeTicketCapacity"
											min="1"
											step="1"
											value={form?.activeTicketCapacity ??
												""}
											inputmode="numeric"
										/>
										<span class="queue-label-hint"
											>Optional; leave blank for unlimited</span
										>
									</label>
								</div>
								<button
									type="submit"
									class="queue-create-submit"
									>Create queue</button
								>
							</form>
						{/if}
					</section>
				{/if}

				{#if data.queues.length > 0}
					<section
						class="staff-card queues-card"
						aria-labelledby="queue-list-title"
					>
						<div class="staff-card-heading">
							<h2 id="queue-list-title">Queue list</h2>
							<span class="staff-card-tag"
								>{filteredQueues.length} shown</span
							>
						</div>
						<div class="queue-filters">
							<label
								>Location
								<select bind:value={locationFilter}>
									<option value="all">All locations</option>
									{#each locations as [id, name]}<option
											value={id}>{name}</option
										>{/each}
								</select>
							</label>
							<label
								>Service
								<select bind:value={serviceFilter}>
									<option value="all">All services</option>
									{#each services as [id, name]}<option
											value={id}>{name}</option
										>{/each}
								</select>
							</label>
							<label
								>Queue status
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
									<thead
										><tr
											><th scope="col">Queue</th><th
												scope="col">Location</th
											><th scope="col">Service</th><th
												scope="col">Visitor identity</th
											><th scope="col">Queue status</th
											><th scope="col">Session</th><th
												scope="col"
														>Active ticket capacity</th><th scope="col">Actions</th></tr
										></thead
									>
									<tbody>
										{#each filteredQueues as queue (queue.id)}
											<tr>
												<th scope="row">{queue.name}</th
												>
												<td>{queue.locationName}</td>
												<td>{queue.serviceName}</td>
												<td
													>{queue.identityPolicy ===
													"anonymous"
														? "Anonymous"
														: "Name required"}</td
												>
												<td
													><span
														class="location-status"
														class:inactive={queue.isActive ===
															0}
														>{queue.isActive === 1
															? "Active"
															: "Inactive"}</span
													></td
												>
												<td
													>{queue.sessionState
														? queue.sessionState[0]!.toUpperCase() +
															queue.sessionState.slice(
																1,
															)
														: "No open session"}</td
												>
												<td
													>{queue.activeTicketCapacity ??
														"Unlimited"}</td
												>
											<td>
												<div class="queue-row-actions">
													{#if queue.sessionId && queue.transitionRequestId && (queue.sessionState === "open" || queue.sessionState === "paused")}
														<form method="POST" action={`?/changeSessionState&organization=${encodeURIComponent(data.organization.organizationId)}`}>
															<input type="hidden" name="queueId" value={queue.id} />
															<input type="hidden" name="sessionId" value={queue.sessionId} />
															<input type="hidden" name="requestId" value={queue.transitionRequestId} />
															<button class="queue-edit-link" type="submit" name="transition" value={queue.sessionState === "open" ? "pause" : "resume"}>{queue.sessionState === "open" ? "Pause" : "Resume"}</button>
															<button class="queue-edit-link" type="submit" name="transition" value="close">Close session</button>
														</form>
													{/if}
													{#if queue.sessionState === null && queue.isActive === 1 && queue.locationIsActive === 1 && queue.serviceIsActive === 1}
														<form method="POST" action={`?/openSession&organization=${encodeURIComponent(data.organization.organizationId)}`}>
															<input type="hidden" name="queueId" value={queue.id} />
															<input type="hidden" name="openRequestId" value={queue.openRequestId} />
															<button class="queue-edit-link" type="submit">Open session</button>
														</form>
													{:else if queue.sessionState === null}
														<span class="queue-label-hint">Activate queue, location, and service to open a session.</span>
													{/if}
													{#if data.organization.role === "admin"}
														<form method="POST" action={`?/setQueueActive&organization=${encodeURIComponent(data.organization.organizationId)}`}>
															<input type="hidden" name="queueId" value={queue.id} />
															<input type="hidden" name="active" value={queue.isActive === 1 ? '0' : '1'} />
															<button class="queue-edit-link" type="submit" aria-label={`${queue.isActive === 1 ? 'Deactivate' : 'Activate'} ${queue.name}`}>
																{queue.isActive === 1 ? 'Deactivate' : 'Activate'}
															</button>
														</form>
														<a
															class="queue-edit-link"
															href={`/staff/queues/${encodeURIComponent(queue.id)}?organization=${encodeURIComponent(data.organization.organizationId)}`}
															>Edit</a
														>
													<QueueShareLink publicId={queue.publicId} queueName={queue.name} />
													{/if}
													</div>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<p class="queue-filter-empty" role="status">
								No queues match these filters.
							</p>
						{/if}
					</section>
				{:else}
					<section
						class="staff-card queue-empty"
						aria-labelledby="queue-empty-title"
					>
						<p class="eyebrow">Queue configuration</p>
						<h2 id="queue-empty-title">No queues yet</h2>
						<p>
							Queues for your {data.organization.role === "admin"
								? "organization"
								: "assigned locations"} will appear here when they
							have been configured.
						</p>
					</section>
				{/if}
			</div>
		</main>
	</div>
</div>
