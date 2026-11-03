import { localDateTimeToUtc, occurrenceKey, occurrenceIsDue } from './queue-scheduling';

type ScheduleRow = {
	id: string; organization_id: string; queue_id: string; enabled: number; weekdays: string;
	signup_open_time: string; service_start_time: string; occurrence_ticket_cap: number | null; version: number;
	timezone: string; queue_active: number; location_active: number; service_active: number;
};

function localDateAt(timestamp: number, timezone: string): string {
	const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp));
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

/** Reconcile today's due local occurrences. Unique schedule/date keys make retries safe. */
export async function reconcileQueueSchedules(db: D1Database, timestamp = Date.now()): Promise<number> {
	const total = await db.prepare('SELECT COUNT(*) AS total FROM queue_schedules WHERE enabled = 1').first<{ total: number }>();
	const batches = Math.max(1, Math.ceil((total?.total ?? 0) / 100));
	const offset = (Math.floor(timestamp / 60_000) % batches) * 100;
	const rows = await db.prepare(`SELECT s.id, s.organization_id, s.queue_id, s.enabled, s.weekdays,
		s.signup_open_time, s.service_start_time, s.occurrence_ticket_cap, s.version,
		l.timezone, q.is_active AS queue_active, l.is_active AS location_active, sv.is_active AS service_active
		FROM queue_schedules s
		JOIN queues q ON q.id = s.queue_id AND q.organization_id = s.organization_id
		JOIN locations l ON l.id = q.location_id AND l.organization_id = q.organization_id
		JOIN services sv ON sv.id = q.service_id AND sv.organization_id = q.organization_id AND sv.location_id = q.location_id
		WHERE s.enabled = 1 ORDER BY s.id LIMIT 100 OFFSET ?`).bind(offset).all<ScheduleRow>();
	let reconciled = 0;
	for (const row of rows.results ?? []) {
		const date = localDateAt(timestamp, row.timezone);
		const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
		let weekdays: unknown;
		try { weekdays = JSON.parse(row.weekdays); } catch { continue; }
		if (!Array.isArray(weekdays) || !weekdays.includes(weekday)) continue;
		const signupOpensAt = localDateTimeToUtc(date, row.signup_open_time, row.timezone);
		const scheduledServiceStartAt = localDateTimeToUtc(date, row.service_start_time, row.timezone);
		if (!signupOpensAt || !scheduledServiceStartAt || !occurrenceIsDue(signupOpensAt, new Date(timestamp).toISOString())) continue;
		const key = occurrenceKey(date);
		const result = await db.prepare(`INSERT OR IGNORE INTO queue_sessions
			(id, organization_id, queue_id, state, opened_at, closed_at, schedule_id, schedule_version,
			occurrence_key, signup_opens_at, scheduled_service_start_at, occurrence_ticket_cap, occurrence_status)
			SELECT ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM queue_sessions current
				WHERE current.queue_id = ? AND current.state IN ('open', 'paused')) THEN 'closed' ELSE 'open' END,
			?, CASE WHEN EXISTS (SELECT 1 FROM queue_sessions current
				WHERE current.queue_id = ? AND current.state IN ('open', 'paused')) THEN ? ELSE NULL END,
			?, ?, ?, ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM queue_sessions current
				WHERE current.queue_id = ? AND current.state IN ('open', 'paused')) THEN 'blocked' ELSE 'active' END
			WHERE ? = 1 AND ? = 1 AND ? = 1`)
			.bind(crypto.randomUUID(), row.organization_id, row.queue_id, row.queue_id, signupOpensAt,
				row.queue_id, new Date(timestamp).toISOString(), row.id, row.version, key, signupOpensAt,
				scheduledServiceStartAt, row.occurrence_ticket_cap, row.queue_id,
				row.queue_active, row.location_active, row.service_active).run();
		reconciled += result.meta.changes ?? 0;
	}
	return reconciled;
}
