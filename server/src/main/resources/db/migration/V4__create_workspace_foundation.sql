CREATE TABLE workspace (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES "user" (id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX ix_workspace_owner_id ON workspace (owner_id);

CREATE TABLE workspace_role (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT uq_workspace_role_workspace_name UNIQUE (workspace_id, name)
);

CREATE TABLE workspace_member (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES workspace_role (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT uq_workspace_member_workspace_user UNIQUE (workspace_id, user_id)
);

CREATE INDEX ix_workspace_member_user_id ON workspace_member (user_id);
CREATE INDEX ix_workspace_member_role_id ON workspace_member (role_id);
