<script lang="ts">
	import { onMount } from "svelte";
	import { invalidateAll } from "$app/navigation";
	import type { PageProps } from "./$types";
	import { getVisitorTicketPresentation } from "#lib/visitor-ticket-presentation";
	let { data, form }: PageProps = $props();
	const presentation = $derived(
		getVisitorTicketPresentation(
			data.ticket.status,
			data.ticket.number,
			data.ticket.serviceName,
		),
	);
	let copyMessage = $state("");
	let refreshMessage = $state("");
	let refreshing = false;
	async function refreshTicket() {
		if (refreshing || !presentation.shouldPoll) return;
		refreshing = true;
		try {
			await invalidateAll();
			refreshMessage = "";
		} catch {
			refreshMessage =
				"We could not refresh your ticket. We will try again shortly.";
		} finally {
			refreshing = false;
		}
	}
	onMount(() => {
		const interval = window.setInterval(() => void refreshTicket(), 5000);
		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") void refreshTicket();
		};
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			window.clearInterval(interval);
			document.removeEventListener(
				"visibilitychange",
				onVisibilityChange,
			);
		};
	});
	async function copyTrackingLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copyMessage = "Private tracking link copied.";
		} catch {
			copyMessage =
				"Copy is unavailable in this browser. Use your browser menu to share or bookmark this page.";
		}
	}
</script>

<svelte:head>
	<title>Ticket {data.ticket.number} · Kewkew</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<main class="public-queue-page">
	<a class="public-queue-brand" href="/" aria-label="Kewkew home"
		><span class="brand-mark" aria-hidden="true">k</span><span>Kewkew</span
		></a
	>
	<section
		class="public-queue-card ticket-tracking-card"
		aria-labelledby="ticket-title"
	>
		<p class="eyebrow">
			{data.ticket.organizationName}:
			<span class="public-queue-service"
				>{data.ticket.serviceName} · {data.ticket.locationName}</span
			>
		</p>
		<h1 id="ticket-title">You are ticket #{data.ticket.number}</h1>

		<div
			class="public-queue-state"
			class:called={presentation.isCalled}
			class:unavailable={["cancelled", "no_show"].includes(
				data.ticket.status,
			)}
			class:available={!["cancelled", "no_show"].includes(
				data.ticket.status,
			)}
			role="status"
			aria-live={presentation.isCalled ? "assertive" : "polite"}
			aria-atomic="true"
		>
			<span aria-hidden="true"></span>
			<div>
				<strong>{presentation.label}</strong>
				<p>{presentation.message}</p>
				{#if presentation.showPosition && data.ticket.position !== null}<p>
						Position in line: {data.ticket.position}
					</p>{/if}
			</div>
		</div>
		{#if refreshMessage}<p class="ticket-refresh-message" role="status">
				{refreshMessage}
			</p>{/if}
		{#if data.ticket.status === "waiting"}
			<form method="POST" action="?/cancel" class="ticket-cancel-form">
				<label
					><input
						type="checkbox"
						name="confirmCancellation"
						value="yes"
						required
					/> I want to leave this queue.</label
				>
				<button type="submit">Leave queue</button>
				{#if form?.cancelMessage}<p
						class="public-join-error"
						role="alert"
					>
						{form.cancelMessage}
					</p>{/if}
			</form>
		{:else if ["called", "serving"].includes(data.ticket.status)}
			<p class="ticket-cancel-unavailable">
				You can leave only while your ticket is waiting. Ask staff for
				help if you can no longer wait.
			</p>
		{/if}
		{#if data.ticket.status !== "completed"}
			<div class="ticket-tracking-actions">
				<button type="button" onclick={copyTrackingLink}
					>Copy private tracking link</button
				>
				{#if copyMessage}<p role="status">{copyMessage}</p>{/if}
			</div>
		{/if}
		<p class="public-queue-note">
			Your ticket updates automatically while this page is open. Save this
			private link to check again later; it expires 90 days after signup.
			Your ticket number is not a tracking credential.
		</p>
	</section>
</main>
