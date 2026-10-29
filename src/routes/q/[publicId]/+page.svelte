<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
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
					{:else if data.unavailableReason === "queue_full"}
						<p>This queue has reached its current capacity. Please check with staff for your next step.</p>
					{:else}
						<p>This queue does not have an open signup session right now.</p>
					{/if}
				</div>
			</div>
		{/if}
		{#if data.identityPolicy === "anonymous"}
			{#if data.signupAvailable}
				<form method="POST" action="?/join" class="public-join-form">
					<input type="hidden" name="attemptToken" value={form?.attemptToken ?? data.attemptToken} />
					<button type="submit">Join this queue</button>
					{#if form?.joinMessage}<p class="public-join-error" role="alert">{form.joinMessage}</p>{/if}
				</form>
			{:else if data.unavailableReason === "queue_full"}
				<p class="public-join-error" role="status">This queue has reached capacity. Please check with staff for your next step.</p>
			{/if}
		{:else}
			{#if data.signupAvailable}
				<form method="POST" action="?/join" class="public-join-form public-join-name-form">
					<input type="hidden" name="attemptToken" value={form?.attemptToken ?? data.attemptToken} />
					<label for="visitor-first-name">First name</label>
					<input id="visitor-first-name" name="firstName" type="text" autocomplete="given-name" maxlength="100" required value={form?.firstName ?? ""} aria-invalid={form?.fieldErrors?.firstName ? "true" : undefined} aria-describedby={form?.fieldErrors?.firstName ? "visitor-first-name-error" : undefined} />
					{#if form?.fieldErrors?.firstName}<span id="visitor-first-name-error" class="public-join-error" role="alert">{form.fieldErrors.firstName}</span>{/if}
					<label for="visitor-last-name">Last name</label>
					<input id="visitor-last-name" name="lastName" type="text" autocomplete="family-name" maxlength="100" required value={form?.lastName ?? ""} aria-invalid={form?.fieldErrors?.lastName ? "true" : undefined} aria-describedby={form?.fieldErrors?.lastName ? "visitor-last-name-error" : undefined} />
					{#if form?.fieldErrors?.lastName}<span id="visitor-last-name-error" class="public-join-error" role="alert">{form.fieldErrors.lastName}</span>{/if}
					<button type="submit">Join this queue</button>
					{#if form?.joinMessage}<p class="public-join-error" role="alert">{form.joinMessage}</p>{/if}
				</form>
			{:else}
				<p class="public-join-error" role="status">This queue requires first and last name. Please ask staff to assist.</p>
			{/if}
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
