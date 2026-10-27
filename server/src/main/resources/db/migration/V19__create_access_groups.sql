CREATE TABLE access_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    name_key TEXT GENERATED ALWAYS AS (normalize_content_name(name)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT ck_access_group_name CHECK (char_length(name) BETWEEN 1 AND 50),
    CONSTRAINT uq_access_group_workspace_name UNIQUE (workspace_id, name_key),
    CONSTRAINT uq_access_group_id_workspace UNIQUE (id, workspace_id)
);

ALTER TABLE workspace_member
    ADD CONSTRAINT uq_workspace_member_id_workspace UNIQUE (id, workspace_id);

CREATE TABLE access_group_member (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL,
    workspace_member_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_access_group_member_group_workspace
        FOREIGN KEY (group_id, workspace_id)
        REFERENCES access_group (id, workspace_id) ON DELETE RESTRICT,
    CONSTRAINT fk_access_group_member_workspace_member_workspace
        FOREIGN KEY (workspace_member_id, workspace_id)
        REFERENCES workspace_member (id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT uq_access_group_member UNIQUE (group_id, workspace_member_id)
);

CREATE INDEX ix_access_group_member_workspace_member_id ON access_group_member (workspace_member_id);

ALTER TABLE role_permission
    DROP CONSTRAINT role_permission_resource_check,
    DROP CONSTRAINT role_permission_action_check,
    ADD CONSTRAINT role_permission_resource_check
        CHECK (resource IN ('workspace', 'collection', 'item', 'secret', 'member', 'role', 'activity', 'group')),
    ADD CONSTRAINT role_permission_action_check
        CHECK (action IN ('read', 'create', 'update', 'delete', 'invite', 'manage', 'all'));

ALTER TABLE activity_log
    DROP CONSTRAINT ck_activity_log_action,
    DROP CONSTRAINT ck_activity_log_resource_type,
    ADD CONSTRAINT ck_activity_log_action CHECK (action IN (
        'folder_created', 'folder_renamed', 'folder_deleted',
        'item_created', 'item_updated', 'item_archived', 'item_restored', 'item_deleted',
        'member_invited', 'member_joined', 'member_role_changed', 'member_removed',
        'member_invite_revoked', 'member_invite_declined', 'workspace_renamed',
        'role_created', 'role_deleted', 'role_permissions_changed',
        'group_created', 'group_renamed', 'group_deleted', 'group_member_added', 'group_member_removed'
    )),
    ADD CONSTRAINT ck_activity_log_resource_type CHECK (resource_type IN (
        'folder', 'item', 'member', 'workspace', 'role', 'group'
    ));
