ALTER TABLE queue_sessions ADD COLUMN transition_request_id TEXT;

CREATE TABLE queue_session_events (
	id TEXT PRIMARY KEY,
	organization_id TEXT NOT NULL,
	queue_id TEXT NOT NULL,
	session_id TEXT NOT NULL REFERENCES queue_sessions (id) ON DELETE RESTRICT,
	from_state TEXT NOT NULL CHECK (from_state IN ('open', 'paused')),
	to_state TEXT NOT NULL CHECK (to_state IN ('open', 'paused')),
	actor_user_id TEXT NOT NULL,
	request_id TEXT NOT NULL UNIQUE,
	occurred_at TEXT NOT NULL,
	CHECK (from_state <> to_state)
);

CREATE INDEX queue_session_events_by_session_time
	ON queue_session_events (session_id, occurred_at, id);
