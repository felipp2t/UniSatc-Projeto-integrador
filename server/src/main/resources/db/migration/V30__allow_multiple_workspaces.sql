-- Um workspace por equipe: o administrador geral cria workspaces e convida donos ou membros.
ALTER TABLE workspace
    DROP COLUMN IF EXISTS singleton,
    ALTER COLUMN owner_id DROP NOT NULL;

-- Cada pessoa pertence a um único workspace; a sessão continua vinculada a essa membership.
ALTER TABLE workspace_member
    ADD CONSTRAINT uq_workspace_member_user UNIQUE (user_id);

ALTER TABLE "user"
    ADD COLUMN system_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "user" SET system_admin = TRUE WHERE id = 'afd23ecc-4abb-4e2b-b985-3aaa8637a839';

ALTER TABLE user_invite
    ADD COLUMN workspace_id UUID REFERENCES workspace (id) ON DELETE CASCADE,
    ADD COLUMN owner_invite BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE user_invite
SET workspace_id = (SELECT id FROM workspace ORDER BY created_at, id LIMIT 1);

DELETE FROM user_invite WHERE workspace_id IS NULL;

ALTER TABLE user_invite
    ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX ix_user_invite_workspace_id ON user_invite (workspace_id);
