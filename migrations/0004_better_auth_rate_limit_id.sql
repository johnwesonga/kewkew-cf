CREATE TABLE rate_limits_with_id (
	id TEXT PRIMARY KEY,
	key TEXT NOT NULL UNIQUE,
	count INTEGER NOT NULL,
	last_request INTEGER NOT NULL
);

INSERT INTO rate_limits_with_id (id, key, count, last_request)
SELECT lower(hex(randomblob(16))), key, count, last_request
FROM rate_limits;

DROP TABLE rate_limits;

ALTER TABLE rate_limits_with_id RENAME TO rate_limits;
