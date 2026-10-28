ALTER TABLE queues ADD COLUMN public_id TEXT;

UPDATE queues
SET public_id = lower(hex(randomblob(16)))
WHERE public_id IS NULL;

CREATE UNIQUE INDEX queues_public_id_unique
	ON queues (public_id);
