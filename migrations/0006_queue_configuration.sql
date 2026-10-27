CREATE TABLE queues (
	id TEXT PRIMARY KEY,
	organization_id TEXT NOT NULL,
	location_id TEXT NOT NULL,
	service_id TEXT NOT NULL,
	name TEXT NOT NULL CHECK (length(trim(name)) > 0),
	identity_policy TEXT NOT NULL CHECK (identity_policy IN ('anonymous', 'name_required')),
	active_ticket_capacity INTEGER CHECK (active_ticket_capacity IS NULL OR active_ticket_capacity > 0),
	is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	UNIQUE (organization_id, id),
	FOREIGN KEY (organization_id, location_id)
		REFERENCES locations (organization_id, id) ON DELETE RESTRICT,
	FOREIGN KEY (organization_id, service_id)
		REFERENCES services (organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX queues_by_organization_location
	ON queues (organization_id, location_id, name);

CREATE TABLE queue_sessions (
	id TEXT PRIMARY KEY,
	organization_id TEXT NOT NULL,
	queue_id TEXT NOT NULL,
	state TEXT NOT NULL CHECK (state IN ('open', 'paused', 'closed')),
	opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	closed_at TEXT,
	FOREIGN KEY (organization_id, queue_id)
		REFERENCES queues (organization_id, id) ON DELETE RESTRICT,
	CHECK ((state = 'closed' AND closed_at IS NOT NULL) OR (state <> 'closed' AND closed_at IS NULL))
);

CREATE UNIQUE INDEX queue_sessions_one_current_per_queue
	ON queue_sessions (queue_id)
	WHERE state IN ('open', 'paused');

CREATE INDEX queue_sessions_by_queue_opened
	ON queue_sessions (organization_id, queue_id, opened_at DESC);
