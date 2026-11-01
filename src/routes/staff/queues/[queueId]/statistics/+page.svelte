<script lang="ts">
	import StaffSidebar from '#lib/StaffSidebar.svelte';
	import StaffAccountChip from '#lib/StaffAccountChip.svelte';
	import type { PageProps } from './$types';
	import { formatStatisticsDay } from '#lib/queue-statistics';

	let { data }: PageProps = $props();
	let organizationQuery = $derived(`?organization=${encodeURIComponent(data.organization.organizationId)}`);
	const width = 900;
	const height = 330;
	const left = 62;
	const right = 840;
	const top = 28;
	const bottom = 260;
	let maxServed = $derived(Math.max(1, ...data.days.map((day) => day.served)));
	let maxWait = $derived(Math.max(1, ...data.days.map((day) => day.averageWaitMinutes ?? 0)));
	let step = $derived((right - left) / Math.max(data.days.length, 1));
	let barWidth = $derived(Math.max(2, Math.min(18, step * 0.58)));
	let bars = $derived(data.days.map((day, index) => ({
		...day,
		x: left + step * index + (step - barWidth) / 2,
		y: bottom - (day.served / maxServed) * (bottom - top),
		barHeight: (day.served / maxServed) * (bottom - top),
		center: left + step * index + step / 2,
		showLabel: data.days.length <= 10 || index % Math.ceil(data.days.length / 7) === 0 || index === data.days.length - 1
	})));
	let waitPoints = $derived(bars.filter((day) => day.averageWaitMinutes !== null).map((day) => ({
		x: day.center,
		y: bottom - ((day.averageWaitMinutes ?? 0) / maxWait) * (bottom - top)
	})));
	let waitPath = $derived(waitPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '));
	let rangeTitle = $derived(`Last ${data.range} days`);
</script>

<svelte:head>
	<title>{data.queue.name} statistics · Kewkew</title>
	<meta name="description" content="Queue service statistics for {data.queue.name}." />
</svelte:head>

<div class="staff-shell">
	<header class="topbar">
		<a class="brand" href="/staff" aria-label="Kewkew staff workspace"><span class="brand-mark" aria-hidden="true">k</span><span class="brand-name">Kewkew<small>Queue, without the wait</small></span></a>
		<div class="staff-header-actions">
			{#if data.organizations.length > 1}
				<form class="staff-workspace-switcher" method="GET" action={`/staff/queues/${encodeURIComponent(data.queue.id)}/statistics`}>
					<label for="organization-switch">Organization</label>
					<select id="organization-switch" name="organization" value={data.organization.organizationId}>
						{#each data.organizations as organization}<option value={organization.organizationId}>{organization.organizationName}</option>{/each}
					</select>
					<button type="submit">Switch</button>
				</form>
			{:else}<span class="staff-current-organization">{data.organization.organizationName}</span>{/if}
			<StaffAccountChip name={data.user.name} email={data.user.email} />
			<form method="POST" action="/staff?/signOut"><button class="staff-signout" type="submit">Sign out</button></form>
		</div>
	</header>

	<div class="staff-workspace">
		<StaffSidebar organizationId={data.organization.organizationId} organizationRole={data.organization.role} locationCount={data.locationCount} active="live" />
		<main class="staff-content">
			<div class="staff-page">
				<a class="queue-back-link" href={`/staff/queues/${encodeURIComponent(data.queue.id)}/board${organizationQuery}`}>← Back to live queue</a>
				<header class="staff-page-heading">
					<div><p class="eyebrow">Queue statistics</p><h1>{data.queue.name}</h1><p class="staff-page-subhead">{data.queue.locationName} · {data.queue.serviceName} · {data.queue.timezone}</p></div>
					<form class="statistics-range-form" method="GET" action={`/staff/queues/${encodeURIComponent(data.queue.id)}/statistics`}>
						<input type="hidden" name="organization" value={data.organization.organizationId} />
						<label for="statistics-range">Time range</label>
						<select id="statistics-range" name="range" value={data.range}>
							<option value="7">Last 7 days</option>
							<option value="30">Last 30 days</option>
							<option value="90">Last 90 days</option>
						</select>
						<button type="submit">Apply</button>
					</form>
				</header>

				{#if data.statisticsError}
					<section class="staff-card statistics-message error-message" role="alert"><h2>Statistics could not be loaded</h2><p>Refresh this page to try again.</p></section>
				{:else}
					<section class="statistics-summary" aria-label="{rangeTitle} summary">
						<article class="staff-card statistics-summary-card"><span>Visitors served</span><strong>{data.servedTotal}</strong><small>Completed tickets in {rangeTitle.toLowerCase()}</small></article>
						<article class="staff-card statistics-summary-card"><span>Average wait</span><strong>{data.avgWaitMinutes === null ? '—' : `${Math.round(data.avgWaitMinutes * 10) / 10} min`}</strong><small>Signup to first call for completed tickets</small></article>
					</section>
					<section class="staff-card statistics-chart-card" aria-labelledby="statistics-chart-title">
						<div class="staff-card-heading"><div><h2 id="statistics-chart-title">Queue activity · {rangeTitle}</h2><p>Daily totals use {data.queue.timezone}.</p></div></div>
						<div class="statistics-legend"><span><i class="statistics-legend-served"></i>Visitors served</span><span><i class="statistics-legend-wait"></i>Average wait (minutes)</span></div>
						{#if data.servedTotal === 0}
							<div class="statistics-empty"><strong>No completed tickets in this range</strong><p>Completed queue activity will appear here.</p></div>
						{/if}
						<div class="statistics-chart-scroll">
							<svg class="statistics-chart" viewBox="0 0 {width} {height}" role="img" aria-label="Daily visitors served and average wait for {data.queue.name}, {rangeTitle}, in {data.queue.timezone}">
								<text x="8" y="18" class="statistics-axis-title">Served</text>
								<text x={width - 8} y="18" text-anchor="end" class="statistics-axis-title">Wait min</text>
								{#each [0, 0.5, 1] as fraction}
									{@const y = bottom - fraction * (bottom - top)}
									<line x1={left} x2={right} y1={y} y2={y} class="statistics-gridline" />
									<text x={left - 10} y={y + 4} text-anchor="end" class="statistics-axis-label">{Math.round(maxServed * fraction)}</text>
									<text x={right + 10} y={y + 4} class="statistics-axis-label">{Math.round(maxWait * fraction)}</text>
								{/each}
								{#each bars as day}
									<rect x={day.x} y={day.y} width={barWidth} height={day.barHeight} rx="2" class="statistics-served-bar"><title>{day.date}: {day.served} served</title></rect>
									{#if day.showLabel}<text x={day.center} y={bottom + 22} text-anchor="middle" class="statistics-date-label">{formatStatisticsDay(day.date, data.queue.timezone)}</text>{/if}
								{/each}
								{#if waitPoints.length > 0}<path d={waitPath} class="statistics-wait-line" fill="none" />{/if}
								{#each waitPoints as point}<circle cx={point.x} cy={point.y} r="3.5" class="statistics-wait-point" />{/each}
							</svg>
						</div>
						<p class="statistics-definition">Served counts tickets completed in the selected range. Average wait is measured from signup to a ticket’s first call, for completed tickets with a call event. Cancelled and no-show tickets are excluded.</p>
						<details class="statistics-data-details"><summary>View daily data</summary><div class="statistics-table-wrap"><table><thead><tr><th>Date</th><th>Visitors served</th><th>Average wait</th></tr></thead><tbody>{#each data.days as day}<tr><td>{formatStatisticsDay(day.date, data.queue.timezone, { year: 'numeric' })}</td><td>{day.served}</td><td>{day.averageWaitMinutes === null ? '—' : `${Math.round(day.averageWaitMinutes * 10) / 10} min`}</td></tr>{/each}</tbody></table></div></details>
					</section>
				{/if}
			</div>
		</main>
	</div>
</div>
