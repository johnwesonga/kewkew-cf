ALTER TABLE tickets
	ADD COLUMN identity_policy TEXT NOT NULL DEFAULT 'anonymous'
	CHECK (identity_policy IN ('anonymous', 'name_required'));

UPDATE tickets
SET identity_policy = 'name_required'
WHERE first_name IS NOT NULL AND last_name IS NOT NULL;
