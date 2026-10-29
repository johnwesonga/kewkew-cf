ALTER TABLE queue_sessions ADD COLUMN next_ticket_number INTEGER NOT NULL DEFAULT 1 CHECK (next_ticket_number > 0);
ALTER TABLE queue_sessions ADD COLUMN next_queue_sequence INTEGER NOT NULL DEFAULT 1 CHECK (next_queue_sequence > 0);
ALTER TABLE queue_sessions ADD COLUMN last_join_attempt_digest TEXT;

CREATE TABLE tickets (
	id TEXT PRIMARY KEY,
	organization_id TEXT NOT NULL,
	queue_id TEXT NOT NULL,
	queue_session_id TEXT NOT NULL REFERENCES queue_sessions (id) ON DELETE RESTRICT,
	ticket_number INTEGER NOT NULL CHECK (ticket_number > 0),
	queue_sequence INTEGER NOT NULL CHECK (queue_sequence > 0),
	join_attempt_digest TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show')),
	first_name TEXT,
	last_name TEXT,
	joined_at TEXT NOT NULL,
	called_at TEXT,
	started_at TEXT,
	completed_at TEXT,
	cancelled_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE (queue_session_id, ticket_number),
	UNIQUE (queue_session_id, queue_sequence),
	UNIQUE (queue_session_id, join_attempt_digest),
	FOREIGN KEY (organization_id, queue_id) REFERENCES queues (organization_id, id) ON DELETE RESTRICT,
	CHECK ((first_name IS NULL AND last_name IS NULL) OR (length(trim(first_name)) > 0 AND length(trim(last_name)) > 0))
);

CREATE INDEX tickets_by_session_status_sequence
	ON tickets (queue_session_id, status, queue_sequence);

CREATE TABLE ticket_events (
	id TEXT PRIMARY KEY,
	ticket_id TEXT NOT NULL REFERENCES tickets (id) ON DELETE RESTRICT,
	from_status TEXT CHECK (from_status IN ('waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show')),
	to_status TEXT NOT NULL CHECK (to_status IN ('waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show')),
	actor_type TEXT NOT NULL CHECK (actor_type IN ('visitor', 'staff', 'system')),
	actor_id TEXT,
	occurred_at TEXT NOT NULL,
	metadata TEXT,
	created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX ticket_events_joined_once
	ON ticket_events (ticket_id)
	WHERE from_status IS NULL AND to_status = 'waiting' AND actor_type = 'visitor';

CREATE INDEX ticket_events_by_ticket_time
	ON ticket_events (ticket_id, occurred_at, id);

CREATE TABLE tracking_credentials (
	id TEXT PRIMARY KEY,
	ticket_id TEXT NOT NULL REFERENCES tickets (id) ON DELETE RESTRICT,
	token_digest TEXT NOT NULL UNIQUE,
	created_at TEXT NOT NULL,
	expires_at TEXT,
	revoked_at TEXT
);

CREATE INDEX tracking_credentials_by_ticket
	ON tracking_credentials (ticket_id);

CREATE TABLE browser_ticket_claims (
	queue_session_id TEXT NOT NULL REFERENCES queue_sessions (id) ON DELETE RESTRICT,
	ticket_id TEXT NOT NULL REFERENCES tickets (id) ON DELETE RESTRICT,
	credential_digest TEXT NOT NULL,
	created_at TEXT NOT NULL,
	PRIMARY KEY (queue_session_id, credential_digest)
);

CREATE INDEX browser_ticket_claims_by_ticket
	ON browser_ticket_claims (ticket_id);
