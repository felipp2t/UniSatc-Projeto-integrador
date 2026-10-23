CREATE TYPE workspace_invite_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

ALTER TABLE user_invite
    ADD COLUMN status workspace_invite_status NOT NULL DEFAULT 'PENDING';
