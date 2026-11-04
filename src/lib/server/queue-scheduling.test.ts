import { describe, expect, it } from 'vitest';
import { hasOccurrenceCapacity, localDateTimeToUtc, nextScheduledOccurrence, occurrenceIsDue, occurrenceKey, validateQueueSchedule } from './queue-scheduling';

const base = { weekdays: [1, 3, 5], signupOpenTime: '09:00', serviceStartTime: '10:00', occurrenceTicketCap: '', timezone: 'America/Los_Angeles' };

describe('validateQueueSchedule', () => {
	it('normalizes weekdays and accepts an unlimited schedule', () => {
		expect(validateQueueSchedule({ ...base, weekdays: [5, 1, 5] })).toEqual({
			valid: true,
			value: { weekdays: [1, 5], signupOpenTime: '09:00', serviceStartTime: '10:00', occurrenceTicketCap: null }
		});
	});
	it.each([
		{ weekdays: [], signupOpenTime: '09:00', serviceStartTime: '10:00', occurrenceTicketCap: '', timezone: 'UTC' },
		{ ...base, weekdays: [7] },
		{ ...base, signupOpenTime: '9:00' },
		{ ...base, timezone: 'not/a-zone' },
		{ ...base, serviceStartTime: '08:59' },
		{ ...base, occurrenceTicketCap: '0' }
	])('rejects invalid schedule input %#', (input) => {
		expect(validateQueueSchedule(input).valid).toBe(false);
	});
});

describe('localDateTimeToUtc', () => {
	it('converts local dates using the location timezone', () => {
		expect(localDateTimeToUtc('2026-01-05', '09:00', 'America/Los_Angeles')).toBe('2026-01-05T17:00:00.000Z');
	});
	it('chooses the earlier instant for an ambiguous daylight-saving time', () => {
		expect(localDateTimeToUtc('2026-11-01', '01:30', 'America/Los_Angeles')).toBe('2026-11-01T08:30:00.000Z');
	});
	it('moves a nonexistent daylight-saving time forward by the gap', () => {
		expect(localDateTimeToUtc('2026-03-08', '02:30', 'America/Los_Angeles')).toBe('2026-03-08T10:00:00.000Z');
	});
});

describe('occurrence scheduling helpers', () => {
	it('uses the local occurrence date as a stable idempotency key', () => expect(occurrenceKey('2026-01-05')).toBe('2026-01-05'));
	it('opens only when the persisted opening timestamp has passed', () => {
		expect(occurrenceIsDue('2026-01-05T17:00:00.000Z', '2026-01-05T17:00:00.000Z')).toBe(true);
		expect(occurrenceIsDue('2026-01-05T17:00:00.000Z', '2026-01-05T16:59:59.999Z')).toBe(false);
	});
	it('previews today when service has not started and retains the timezone-local opening time', () => {
		expect(nextScheduledOccurrence(Date.parse('2026-01-05T16:00:00.000Z'), 'America/Los_Angeles', [1], '09:00', '10:00')).toEqual({
			occurrenceKey: '2026-01-05',
			signupOpensAt: '2026-01-05T17:00:00.000Z',
			scheduledServiceStartAt: '2026-01-05T18:00:00.000Z'
		});
	});
	it('advances to the next configured weekday after today’s service start', () => {
		expect(nextScheduledOccurrence(Date.parse('2026-01-05T19:00:00.000Z'), 'America/Los_Angeles', [1], '09:00', '10:00')?.occurrenceKey)
			.toBe('2026-01-12');
	});
	it('resolves a preview using daylight-saving rules for the occurrence date', () => {
		expect(nextScheduledOccurrence(Date.parse('2026-03-08T07:00:00.000Z'), 'America/Los_Angeles', [0], '01:30', '02:30'))
			.toMatchObject({ scheduledServiceStartAt: '2026-03-08T10:00:00.000Z' });
	});
	it('does not replenish an occurrence cap for terminal tickets', () => {
		expect(hasOccurrenceCapacity(3, 2)).toBe(true);
		expect(hasOccurrenceCapacity(3, 3)).toBe(false);
		expect(hasOccurrenceCapacity(null, 100)).toBe(true);
	});
});
