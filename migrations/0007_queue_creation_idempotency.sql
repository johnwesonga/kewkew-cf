ALTER TABLE queues ADD COLUMN created_by_user_id TEXT REFERENCES users (id) ON DELETE RESTRICT;
ALTER TABLE queues ADD COLUMN create_request_id TEXT;

CREATE UNIQUE INDEX queues_create_request_once
	ON queues (organization_id, created_by_user_id, create_request_id);
