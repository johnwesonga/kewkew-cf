ALTER TABLE queue_sessions ADD COLUMN open_request_id TEXT;

CREATE UNIQUE INDEX queue_sessions_open_request_once
	ON queue_sessions (queue_id, open_request_id);
