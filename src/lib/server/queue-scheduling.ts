import { isValidIanaTimezone } from '#lib/timezones';

export type QueueScheduleInput = {
	weekdays: readonly number[];
	signupOpenTime: string;
	serviceStartTime: string;
	occurrenceTicketCap: string;
	timezone: string;
};

export type QueueSchedule = {
	weekdays: number[];
	signupOpenTime: string;
	serviceStartTime: string;
	occurrenceTicketCap: number | null;
};

export function validateQueueSchedule(input: QueueScheduleInput): { valid: true; value: QueueSchedule } | { valid: false; message: string } {
	if (!isValidIanaTimezone(input.timezone)) return { valid: false, message: 'The queue location must have a valid IANA timezone.' };
	const weekdays = [...new Set(input.weekdays)];
	if (weekdays.length === 0 || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
		return { valid: false, message: 'Choose one or more valid weekdays.' };
	}
	const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
	if (!validTime(input.signupOpenTime) || !validTime(input.serviceStartTime)) {
		return { valid: false, message: 'Enter valid local times in 24-hour HH:MM format.' };
	}
	if (input.serviceStartTime <= input.signupOpenTime) {
		return { valid: false, message: 'Service start must be later than signup opening.' };
	}
	const cap = input.occurrenceTicketCap.trim();
	if (cap && (!/^[1-9]\d*$/.test(cap) || !Number.isSafeInteger(Number(cap)))) {
		return { valid: false, message: 'Occurrence ticket cap must be a positive whole number or blank.' };
	}
	return { valid: true, value: { weekdays: weekdays.sort(), signupOpenTime: input.signupOpenTime, serviceStartTime: input.serviceStartTime, occurrenceTicketCap: cap ? Number(cap) : null } };
}

function zonedParts(timestamp: number, timezone: string): Record<string, string> {
	return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
		timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
	}).formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]));
}

/** Resolve a local wall time deterministically: choose the earlier instant in a repeated DST hour; shift gaps forward by the gap. */
export function localDateTimeToUtc(date: string, time: string, timezone: string): string | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !isValidIanaTimezone(timezone)) return null;
	const [year, month, day] = date.split('-').map(Number);
	const [hour, minute] = time.split(':').map(Number);
	const target = Date.UTC(year!, month! - 1, day!, hour!, minute!);
	if (new Date(target).toISOString().slice(0, 10) !== date || hour! > 23 || minute! > 59) return null;
	const candidates: number[] = [];
	for (let delta = -14 * 60; delta <= 14 * 60; delta += 15) {
		const instant = target + delta * 60_000;
		const parts = zonedParts(instant, timezone);
		const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
		const requested = `${date}T${time}`;
		if (local === requested) candidates.push(instant);
	}
	if (candidates.length) return new Date(Math.min(...candidates)).toISOString();
	// For nonexistent wall times, select the first local minute after the gap.
	let best: { instant: number; local: string } | null = null;
	for (let delta = -14 * 60; delta <= 14 * 60; delta += 1) {
		const shifted = target + delta * 60_000;
		const parts = zonedParts(shifted, timezone);
		const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
		if (local > `${date}T${time}` && (!best || local < best.local || (local === best.local && shifted < best.instant))) best = { instant: shifted, local };
	}
	return best ? new Date(best.instant).toISOString() : null;
}

export function resolveManualServiceStart(dateInput: string, timeInput: string, timezone: string):
	| { valid: true; timestamp: string | null; ambiguous: boolean }
	| { valid: false; message: string } {
	const date = dateInput.trim();
	const time = timeInput.trim();
	if (!date && !time) return { valid: true, timestamp: null, ambiguous: false };
	if (!date || !time) return { valid: false, message: 'Enter both the service start date and time, or leave both blank.' };
	if (!isValidIanaTimezone(timezone)) return { valid: false, message: 'The queue location must have a valid IANA timezone.' };
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
		return { valid: false, message: 'Enter a valid service start date and time.' };
	}
	const [year, month, day] = date.split('-').map(Number);
	const [hour, minute] = time.split(':').map(Number);
	const target = Date.UTC(year!, month! - 1, day!, hour!, minute!);
	if (new Date(target).toISOString().slice(0, 10) !== date || hour! > 23 || minute! > 59) {
		return { valid: false, message: 'Enter a valid service start date and time.' };
	}
	const candidates: number[] = [];
	for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
		const instant = target + offset * 60_000;
		const parts = zonedParts(instant, timezone);
		if (`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` === `${date}T${time}`) candidates.push(instant);
	}
	if (candidates.length === 0) {
		return { valid: false, message: 'That local time does not exist because of a daylight-saving clock change. Choose another time.' };
	}
	return { valid: true, timestamp: new Date(Math.min(...candidates)).toISOString(), ambiguous: candidates.length > 1 };
}

export function occurrenceKey(date: string): string {
	return date;
}

export function occurrenceIsDue(signupOpensAt: string, now: string): boolean {
	return Number.isFinite(Date.parse(signupOpensAt)) && Date.parse(signupOpensAt) <= Date.parse(now);
}

export function nextScheduledOccurrence(
	now: number,
	timezone: string,
	weekdays: readonly number[],
	signupOpenTime: string,
	serviceStartTime: string
): { occurrenceKey: string; signupOpensAt: string; scheduledServiceStartAt: string } | null {
	if (!isValidIanaTimezone(timezone) || weekdays.length === 0) return null;
	const current = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
	}).formatToParts(new Date(now)).map(({ type, value }) => [type, value]));
	const today = `${current.year}-${current.month}-${current.day}`;
	const [year, month, day] = today.split('-').map(Number);
	for (let offset = 0; offset <= 7; offset += 1) {
		const date = new Date(Date.UTC(year!, month! - 1, day! + offset));
		const occurrenceKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
		if (!weekdays.includes(date.getUTCDay())) continue;
		const signupOpensAt = localDateTimeToUtc(occurrenceKey, signupOpenTime, timezone);
		const scheduledServiceStartAt = localDateTimeToUtc(occurrenceKey, serviceStartTime, timezone);
		if (signupOpensAt && scheduledServiceStartAt && Date.parse(scheduledServiceStartAt) >= now) {
			return { occurrenceKey, signupOpensAt, scheduledServiceStartAt };
		}
	}
	return null;
}

export function hasOccurrenceCapacity(cap: number | null, issuedCount: number): boolean {
	return cap === null || issuedCount < cap;
}
