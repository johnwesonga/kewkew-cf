CREATE TABLE organizations (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL CHECK (length(trim(name)) > 0),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE users (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL CHECK (length(trim(name)) > 0),
	email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(email)) > 3),
	email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
	image TEXT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE organization_memberships (
	organization_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY (organization_id, user_id),
	FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
	FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX organization_memberships_by_user_status
	ON organization_memberships (user_id, status, organization_id);

CREATE TABLE locations (
	id TEXT PRIMARY KEY,
	organization_id TEXT NOT NULL,
	name TEXT NOT NULL CHECK (length(trim(name)) > 0),
	timezone TEXT NOT NULL CHECK (length(trim(timezone)) > 0),
	is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	UNIQUE (organization_id, id),
	FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);

CREATE INDEX locations_by_organization_active
	ON locations (organization_id, is_active, name);

CREATE TABLE services (
	id TEXT PRIMARY KEY,
	organization_id TEXT NOT NULL,
	location_id TEXT NOT NULL,
	name TEXT NOT NULL CHECK (length(trim(name)) > 0),
	description TEXT,
	is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	UNIQUE (organization_id, id),
	FOREIGN KEY (organization_id, location_id)
		REFERENCES locations (organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX services_by_location_active
	ON services (organization_id, location_id, is_active, name);

CREATE TABLE membership_location_access (
	organization_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	location_id TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY (organization_id, user_id, location_id),
	FOREIGN KEY (organization_id, user_id)
		REFERENCES organization_memberships (organization_id, user_id) ON DELETE RESTRICT,
	FOREIGN KEY (organization_id, location_id)
		REFERENCES locations (organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX membership_location_access_by_location
	ON membership_location_access (organization_id, location_id, user_id);

CREATE TABLE membership_audit_events (
	id TEXT PRIMARY KEY,
	organization_id TEXT NOT NULL,
	actor_user_id TEXT NOT NULL,
	subject_user_id TEXT NOT NULL,
	change_type TEXT NOT NULL CHECK (
		change_type IN (
			'membership_created',
			'role_changed',
			'location_access_changed',
			'suspended',
			'reactivated',
			'invitation_accepted'
		)
	),
	before_role TEXT CHECK (before_role IS NULL OR before_role IN ('admin', 'operator')),
	after_role TEXT CHECK (after_role IS NULL OR after_role IN ('admin', 'operator')),
	before_status TEXT CHECK (before_status IS NULL OR before_status IN ('active', 'suspended')),
	after_status TEXT CHECK (after_status IS NULL OR after_status IN ('active', 'suspended')),
	details_json TEXT CHECK (details_json IS NULL OR json_valid(details_json)),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (organization_id, actor_user_id)
		REFERENCES organization_memberships (organization_id, user_id) ON DELETE RESTRICT,
	FOREIGN KEY (organization_id, subject_user_id)
		REFERENCES organization_memberships (organization_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX membership_audit_by_subject_time
	ON membership_audit_events (organization_id, subject_user_id, created_at DESC);
