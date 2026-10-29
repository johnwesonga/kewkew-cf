<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let copyMessage = $state('');
	let refreshMessage = $state('');
	let refreshing = false;
	const activeStatuses = new Set(['waiting', 'called', 'serving']);
	async function refreshTicket() {
		if (refreshing || !activeStatuses.has(data.ticket.status)) return;
		refreshing = true;
		try {
			await invalidateAll();
			refreshMessage = '';
		} catch {
			refreshMessage = 'We could not refresh your ticket. We will try again shortly.';
		} finally {
			refreshing = false;
		}
	}
	onMount(() => {
		const interval = window.setInterval(() => void refreshTicket(), 5000);
		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') void refreshTicket();
		};
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			window.clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});
	async function copyTrackingLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copyMessage = 'Private tracking link copied.';
		} catch {
			copyMessage = 'Copy is unavailable in this browser. Use your browser menu to share or bookmark this page.';
		}
	}
	const statusText: Record<string, string> = {
		waiting: 'Waiting', called: 'You have been called', serving: 'You are being served',
		completed: 'Complete', cancelled: 'Cancelled', no_show: 'Marked as no-show'
	};
	const statusMessage: Record<string, string> = {
		waiting: 'Please wait until staff call your ticket number.',
		called: 'Please go to the service desk and have your ticket number ready.',
		serving: 'Your service is in progress.',
		completed: 'Your service is complete. Thank you for visiting.',
		cancelled: 'This ticket was cancelled. Please speak with staff if you need help.',
		no_show: 'Staff marked this ticket as no-show. Please speak with staff for next steps.'
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
		<div class="public-queue-state" class:unavailable={['cancelled', 'no_show'].includes(data.ticket.status)} class:available={!['cancelled', 'no_show'].includes(data.ticket.status)} role="status" aria-live="polite" aria-atomic="true">
			<span aria-hidden="true"></span>
			<div>
				<strong>{statusText[data.ticket.status] ?? 'Status unavailable'}</strong>
				<p>{statusMessage[data.ticket.status] ?? 'Check with staff for your ticket status.'}</p>
				{#if data.ticket.position !== null}<p>Position in line: {data.ticket.position}</p>{/if}
			</div>
		</div>
		{#if refreshMessage}<p class="ticket-refresh-message" role="status">{refreshMessage}</p>{/if}
		{#if data.ticket.status !== 'completed'}
		<div class="ticket-tracking-actions">
			<button type="button" onclick={copyTrackingLink}>Copy private tracking link</button>
			{#if copyMessage}<p role="status">{copyMessage}</p>{/if}
		</div>
		{/if}
		<p class="public-queue-note">Your ticket updates automatically while this page is open. Save this private link to check again later; it expires 90 days after signup. Your ticket number is not a tracking credential.</p>
	</section>
</main>
