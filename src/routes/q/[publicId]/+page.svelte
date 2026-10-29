<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.queue.name} · Kewkew</title>
	<meta name="description" content={`Public queue information for ${data.queue.name}.`} />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="public-queue-page">
	<a class="public-queue-brand" href="/" aria-label="Kewkew home">
		<span class="brand-mark" aria-hidden="true">k</span>
		<span>Kewkew</span>
	</a>
	<section class="public-queue-card" aria-labelledby="public-queue-title">
		<p class="eyebrow">{data.queue.organizationName}</p>
		<h1 id="public-queue-title">{data.queue.name}</h1>
		<p class="public-queue-service">{data.queue.serviceName} · {data.queue.locationName}</p>
		{#if data.signupAvailable}
			<div class="public-queue-state available" role="status">
				<span aria-hidden="true"></span>
				<div><strong>Signup is open</strong><p>This queue is ready for visitors to join.</p></div>
			</div>
		{:else}
			<div class="public-queue-state unavailable" role="status">
				<span aria-hidden="true"></span>
				<div>
					<strong>Signup is unavailable</strong>
					{#if data.unavailableReason === "queue_inactive"}
						<p>This queue is currently unavailable. Please check back later.</p>
					{:else if data.unavailableReason === "location_inactive"}
						<p>This location is currently unavailable. Please check back later.</p>
					{:else if data.unavailableReason === "service_inactive"}
						<p>This service is currently unavailable. Please check back later.</p>
					{:else if data.unavailableReason === "session_paused"}
						<p>Signup is paused while staff manage the line. Please check back later.</p>
					{:else}
						<p>This queue does not have an open signup session right now.</p>
					{/if}
				</div>
			</div>
		{/if}
		{#if data.serviceChoices.length > 1}
			<details class="public-service-choices">
				<summary>Choose a service at this location</summary>
				<p>Only queues that are open for signup can be selected.</p>
				<ul>
					{#each data.serviceChoices as choice (choice.publicId)}
						<li>
							<div>
								<strong>{choice.serviceName}</strong>
								<span>{choice.queueName}</span>
							</div>
							{#if choice.publicId === data.queue.publicId && choice.signupAvailable}
								<span class="public-choice-current">Current queue</span>
							{:else if choice.signupAvailable}
								<a href={`/q/${encodeURIComponent(choice.publicId)}`}>View queue</a>
							{:else}
								<span class="public-choice-unavailable">Unavailable</span>
							{/if}
						</li>
					{/each}
				</ul>
			</details>
		{/if}
		<p class="public-queue-note">This page is public queue information. It does not provide access to staff tools or private ticket tracking.</p>
	</section>
</main>
