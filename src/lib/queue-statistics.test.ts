import { describe, expect, it } from 'vitest';
import {
	averageWaitMinutes,
	dateKeyAt,
	emptyQueueStatisticsDays,
	formatStatisticsDay,
	localMidnightAsUtc,
	parseQueueStatisticsRange,
	shiftDateKey
} from './queue-statistics';

describe('parseQueueStatisticsRange', () => {
	it.each([
		['7', 7],
		['30', 30],
		['90', 90]
	] as const)('accepts %s days', (input, expected) => {
		expect(parseQueueStatisticsRange(input)).toBe(expected);
	});

	it.each([null, '', '1', '365', '30d', '7.0'])('defaults invalid range %j to 30 days', (input) => {
		expect(parseQueueStatisticsRange(input)).toBe(30);
	});
});

describe('queue statistics dates', () => {
	it('formats dates in the location timezone', () => {
		expect(dateKeyAt('2026-03-01T01:30:00.000Z', 'America/Los_Angeles')).toBe('2026-02-28');
	});

	it('converts local midnight correctly across the spring daylight-saving change', () => {
		expect(localMidnightAsUtc('2026-03-08', 'America/Los_Angeles')).toBe('2026-03-08T08:00:00.000Z');
		expect(localMidnightAsUtc('2026-03-09', 'America/Los_Angeles')).toBe('2026-03-09T07:00:00.000Z');
	});

	it('shifts date keys by calendar days', () => {
		expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
		expect(shiftDateKey('2024-03-01', -1)).toBe('2024-02-29');
	});

	it('creates the requested number of consecutive day buckets ending today', () => {
		expect(emptyQueueStatisticsDays('2026-03-08', 3).map(({ date }) => date)).toEqual([
			'2026-03-06',
			'2026-03-07',
			'2026-03-08'
		]);
	});

	it('formats bucket labels in the requested timezone', () => {
		expect(formatStatisticsDay('2026-03-08', 'America/Los_Angeles')).toBe('Mar 8');
	});
});

describe('averageWaitMinutes', () => {
	it('calculates elapsed minutes from signup to first call', () => {
		expect(averageWaitMinutes('2026-01-01T10:00:00.000Z', '2026-01-01T10:17:30.000Z')).toBe(17.5);
	});

	it('returns null when a first call time is missing', () => {
		expect(averageWaitMinutes('2026-01-01T10:00:00.000Z', null)).toBeNull();
	});

	it('rejects negative or invalid wait durations', () => {
		expect(averageWaitMinutes('2026-01-01T10:20:00.000Z', '2026-01-01T10:00:00.000Z')).toBeNull();
		expect(averageWaitMinutes('invalid', 'also-invalid')).toBeNull();
	});
});
