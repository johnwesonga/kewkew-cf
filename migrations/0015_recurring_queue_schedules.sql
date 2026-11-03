CREATE TABLE queue_schedules (
	id TEXT PRIMARY KEY,
	organization_id TEXT NOT NULL,
	queue_id TEXT NOT NULL UNIQUE,
	enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
	weekdays TEXT NOT NULL,
	signup_open_time TEXT NOT NULL,
	service_start_time TEXT NOT NULL,
	occurrence_ticket_cap INTEGER CHECK (occurrence_ticket_cap IS NULL OR occurrence_ticket_cap > 0),
	version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
	updated_at TEXT NOT NULL,
	FOREIGN KEY (organization_id, queue_id) REFERENCES queues (organization_id, id) ON DELETE CASCADE,
	CHECK (length(weekdays) > 0)
);

ALTER TABLE queue_sessions ADD COLUMN schedule_id TEXT REFERENCES queue_schedules(id);
ALTER TABLE queue_sessions ADD COLUMN schedule_version INTEGER;
ALTER TABLE queue_sessions ADD COLUMN occurrence_key TEXT;
ALTER TABLE queue_sessions ADD COLUMN signup_opens_at TEXT;
ALTER TABLE queue_sessions ADD COLUMN scheduled_service_start_at TEXT;
ALTER TABLE queue_sessions ADD COLUMN occurrence_ticket_cap INTEGER CHECK (occurrence_ticket_cap IS NULL OR occurrence_ticket_cap > 0);
ALTER TABLE queue_sessions ADD COLUMN occurrence_status TEXT NOT NULL DEFAULT 'active' CHECK (occurrence_status IN ('active', 'blocked'));
CREATE UNIQUE INDEX queue_sessions_schedule_occurrence_unique
	ON queue_sessions (schedule_id, occurrence_key) WHERE schedule_id IS NOT NULL;
