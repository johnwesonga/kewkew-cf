<script lang="ts">
	import StaffSidebar from "#lib/StaffSidebar.svelte";
	import StaffAccountChip from "#lib/StaffAccountChip.svelte";

	let { data, form } = $props();
	const days = [
		{ value: 0, label: "Sunday" },
		{ value: 1, label: "Monday" },
		{ value: 2, label: "Tuesday" },
		{ value: 3, label: "Wednesday" },
		{ value: 4, label: "Thursday" },
		{ value: 5, label: "Friday" },
		{ value: 6, label: "Saturday" },
	];
</script>

<svelte:head>
	<title>Schedule · {data.queueName} · Kewkew</title></svelte:head
>

<div class="staff-shell">
	<header class="topbar">
		<a class="brand" href="/staff" aria-label="Kewkew staff workspace"><span class="brand-mark" aria-hidden="true">k</span><span class="brand-name">Kewkew<small>Queue, without the wait</small></span></a>
		<div class="staff-header-actions">
			<span class="staff-current-organization">{data.organizationName}</span>
			<StaffAccountChip name={data.user.name} email={data.user.email} />
			<form method="POST" action="/staff?/signOut"><button class="staff-signout" type="submit">Sign out</button></form>
		</div>
	</header>
	<div class="staff-workspace">
		<StaffSidebar organizationId={data.organizationId} organizationRole="admin" locationCount={data.locationCount} active="queues" />
		<main class="staff-content">
			<div class="staff-page">
	<div class="staff-page-heading">
		<div>
			<p class="eyebrow">Queue schedule</p>
			<h1>{data.queueName}</h1>
			<p class="staff-page-subhead">Times use {data.timezone}.</p>
		</div>
		<a
			class="queue-edit-link"
			href="/staff/queues?organization={encodeURIComponent(
				data.organizationId,
			)}">Back to queues</a
		>
	</div>
	<section class="staff-card schedule-card" aria-labelledby="schedule-form-title">
		<div class="schedule-card-heading">
			<div>
				<p class="eyebrow">Weekly schedule</p>
				<h2 id="schedule-form-title">Recurring signup and service</h2>
				<p>Choose when visitors can join and when staff can start calling the line.</p>
			</div>
			<span class="schedule-status" class:disabled={data.enabled === 0}>
				<i aria-hidden="true"></i>{data.enabled === 0 ? "Paused" : "Active"}
			</span>
		</div>
		{#if data.saved}<p class="staff-feedback success-message" role="status">Schedule saved. Changes apply to future occurrences.</p>{/if}
		{#if form?.message}<p class="staff-feedback error-message" role="alert">{form.message}</p>{/if}
		<form method="POST" action="?/save" class="schedule-form">
			<label class="schedule-enable-control">
				<input type="checkbox" name="enabled" checked={data.enabled !== 0} />
				<span class="schedule-toggle" aria-hidden="true"></span>
				<span class="schedule-enable-copy"><strong>Enable recurring schedule</strong><small>Sessions open automatically on the selected days.</small></span>
			</label>
			<fieldset class="schedule-weekdays">
				<legend>Signup days <span>Select one or more days</span></legend>
				<div class="schedule-day-grid">
					{#each days as day}
						<label class="schedule-day">
							<input type="checkbox" name="weekday" value={day.value} checked={data.weekdays.includes(day.value)} />
							<span>{day.label.slice(0, 3)}</span>
						</label>
					{/each}
				</div>
			</fieldset>
			<div class="schedule-time-grid">
				<label class="schedule-field" for="signup-open-time">
					<span class="schedule-field-label"><i class="signup-dot"></i>Signup opens</span>
					<input id="signup-open-time" type="time" name="signupOpenTime" required value={data.signupOpenTime ?? "09:00"} />
					<small>Visitors can join from this time.</small>
				</label>
				<label class="schedule-field" for="service-start-time">
					<span class="schedule-field-label"><i class="service-dot"></i>Service starts</span>
					<input id="service-start-time" type="time" name="serviceStartTime" required value={data.serviceStartTime ?? "10:00"} />
					<small>Staff can call the next visitor from this time.</small>
				</label>
			</div>
			<label class="schedule-cap-field" for="occurrence-ticket-cap">
				<span><strong>Ticket cap per occurrence</strong><small>Optional. Terminal tickets still count toward the cap.</small></span>
				<input id="occurrence-ticket-cap" type="number" name="occurrenceTicketCap" min="1" step="1" placeholder="No limit" value={data.occurrenceTicketCap ?? ""} />
			</label>
			<footer class="schedule-form-footer">
				<p><strong>Times use {data.timezone}.</strong> During a repeated daylight-saving hour, the earlier time is used. A nonexistent time moves to the first valid minute.</p>
				<button class="schedule-save-button" type="submit">Save schedule <span aria-hidden="true">→</span></button>
			</footer>
		</form>
			</section>
			</div>
		</main>
	</div>
</div>
