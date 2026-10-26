CREATE TABLE sessions (
	id TEXT PRIMARY KEY,
	expires_at TEXT NOT NULL,
	token TEXT NOT NULL UNIQUE,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	ip_address TEXT,
	user_agent TEXT,
	user_id TEXT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX sessions_by_user ON sessions (user_id);

CREATE TABLE accounts (
	id TEXT PRIMARY KEY,
	account_id TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	access_token TEXT,
	refresh_token TEXT,
	id_token TEXT,
	access_token_expires_at TEXT,
	refresh_token_expires_at TEXT,
	scope TEXT,
	password TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX accounts_by_user ON accounts (user_id);
CREATE UNIQUE INDEX accounts_by_provider_account ON accounts (provider_id, account_id);

CREATE TABLE verifications (
	id TEXT PRIMARY KEY,
	identifier TEXT NOT NULL,
	value TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX verifications_by_identifier ON verifications (identifier);

CREATE TABLE installation_setup (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	initialized_at TEXT,
	organization_id TEXT,
	CHECK (
		(initialized_at IS NULL AND organization_id IS NULL)
		OR (initialized_at IS NOT NULL AND organization_id IS NOT NULL)
	),
	FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);

INSERT INTO installation_setup (id, initialized_at, organization_id)
VALUES (1, NULL, NULL);

CREATE TABLE rate_limits (
	key TEXT PRIMARY KEY,
	count INTEGER NOT NULL,
	last_request INTEGER NOT NULL
);
