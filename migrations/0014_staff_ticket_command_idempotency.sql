ALTER TABLE tickets ADD COLUMN transition_request_id TEXT;

CREATE UNIQUE INDEX tickets_transition_request_unique
	ON tickets (transition_request_id)
	WHERE transition_request_id IS NOT NULL;
