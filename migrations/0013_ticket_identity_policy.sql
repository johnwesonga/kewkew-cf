-- 0012 defines identity_policy in the current migration history. Keep this
-- migration as the data backfill for tickets created before that policy was
-- populated.
UPDATE tickets
SET identity_policy = 'name_required'
WHERE first_name IS NOT NULL AND last_name IS NOT NULL;
