export type QueueStatisticsRange = 7 | 30 | 90;

export type QueueStatisticsDay = {
	date: string;
	served: number;
	averageWaitMinutes: number | null;
};

export function parseQueueStatisticsRange(value: string | null): QueueStatisticsRange {
	if (value === '7' || value === '30' || value === '90') return Number(value) as QueueStatisticsRange;
	return 30;
}

function localParts(timestamp: Date, timezone: string): Record<string, string> {
	return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(timestamp).map(({ type, value }) => [type, value]));
}

export function dateKeyAt(timestamp: string | Date, timezone: string): string {
	const parts = localParts(typeof timestamp === 'string' ? new Date(timestamp) : timestamp, timezone);
	return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftDateKey(dateKey: string, days: number): string {
	const [year, month, day] = dateKey.split('-').map(Number);
	const shifted = new Date(Date.UTC(year, month - 1, day + days));
	return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

export function localMidnightAsUtc(dateKey: string, timezone: string): string {
	const [year, month, day] = dateKey.split('-').map(Number);
	const targetLocalEpoch = Date.UTC(year, month - 1, day);
	let guess = targetLocalEpoch;
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const parts = localParts(new Date(guess), timezone);
		const representedLocalEpoch = Date.UTC(
			Number(parts.year), Number(parts.month) - 1, Number(parts.day),
			Number(parts.hour), Number(parts.minute), Number(parts.second)
		);
		const correction = targetLocalEpoch - representedLocalEpoch;
		guess += correction;
		if (correction === 0) break;
	}
	return new Date(guess).toISOString();
}

export function emptyQueueStatisticsDays(today: string, days: number): QueueStatisticsDay[] {
	const firstDate = shiftDateKey(today, -(days - 1));
	return Array.from({ length: days }, (_, index) => ({
		date: shiftDateKey(firstDate, index),
		served: 0,
		averageWaitMinutes: null
	}));
}

export function averageWaitMinutes(joinedAt: string, firstCalledAt: string | null): number | null {
	if (!firstCalledAt) return null;
	const wait = (Date.parse(firstCalledAt) - Date.parse(joinedAt)) / 60_000;
	return Number.isFinite(wait) && wait >= 0 ? wait : null;
}

export function formatStatisticsDay(dateKey: string, timezone: string, options?: Intl.DateTimeFormatOptions): string {
	const [year, month, day] = dateKey.split('-').map(Number);
	return new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		month: 'short',
		day: 'numeric',
		...options
	}).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
