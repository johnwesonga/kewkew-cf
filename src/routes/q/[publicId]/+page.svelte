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
				<div><strong>Signup is open</strong><p>This queue is currently accepting visitors.</p></div>
			</div>
		{:else}
			<div class="public-queue-state unavailable" role="status">
				<span aria-hidden="true"></span>
				<div><strong>Signup is unavailable</strong><p>This queue is not currently accepting visitors. Please check back later.</p></div>
			</div>
		{/if}
		<p class="public-queue-note">This page is public queue information. It does not provide access to staff tools or private ticket tracking.</p>
	</section>
</main>
