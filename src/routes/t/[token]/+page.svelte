<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const statusText: Record<string, string> = {
		waiting: 'Waiting', called: 'You have been called', serving: 'You are being served',
		completed: 'Complete', cancelled: 'Cancelled', no_show: 'Marked as no-show'
	};
</script>

<svelte:head>
	<title>Ticket {data.ticket.number} · Kewkew</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<main class="public-queue-page">
	<a class="public-queue-brand" href="/" aria-label="Kewkew home"><span class="brand-mark" aria-hidden="true">k</span><span>Kewkew</span></a>
	<section class="public-queue-card ticket-tracking-card" aria-labelledby="ticket-title">
		<p class="eyebrow">{data.ticket.organizationName}</p>
		<h1 id="ticket-title">Your ticket</h1>
		<p class="ticket-number">{data.ticket.number}</p>
		<p class="public-queue-service">{data.ticket.serviceName} · {data.ticket.locationName}</p>
		<div class="public-queue-state available" role="status">
			<span aria-hidden="true"></span>
			<div>
				<strong>{statusText[data.ticket.status] ?? 'Status unavailable'}</strong>
				{#if data.ticket.position !== null}<p>Position in line: {data.ticket.position}</p>{/if}
			</div>
		</div>
		<p class="public-queue-note">Save or bookmark this private page to check your ticket again. Your ticket number is not a tracking credential.</p>
	</section>
</main>
