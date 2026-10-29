ALTER TABLE refresh_token
    ADD COLUMN workspace_member_id UUID;

UPDATE refresh_token token
SET workspace_member_id = member.id
FROM workspace_member member
WHERE member.user_id = token.user_id;

DELETE FROM refresh_token
WHERE workspace_member_id IS NULL;

ALTER TABLE refresh_token
    ALTER COLUMN workspace_member_id SET NOT NULL,
    ADD CONSTRAINT fk_refresh_token_workspace_member
        FOREIGN KEY (workspace_member_id) REFERENCES workspace_member (id) ON DELETE CASCADE;

CREATE INDEX ix_refresh_token_workspace_member_id ON refresh_token (workspace_member_id);
