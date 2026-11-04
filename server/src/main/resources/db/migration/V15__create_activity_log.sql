CREATE TABLE activity_log (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL,
    actor_id UUID,
    actor_name VARCHAR(255) NOT NULL,
    actor_context VARCHAR(32) NOT NULL,
    action VARCHAR(80) NOT NULL,
    resource_type VARCHAR(40) NOT NULL,
    resource_id UUID NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_activity_log_action CHECK (action IN (
        'folder_created', 'folder_renamed', 'folder_deleted',
        'item_created', 'item_updated', 'item_archived', 'item_restored', 'item_deleted',
        'member_invited', 'member_joined', 'member_role_changed', 'member_removed',
        'member_invite_revoked', 'member_invite_declined', 'workspace_renamed',
        'role_created', 'role_deleted', 'role_permissions_changed'
    )),
    CONSTRAINT ck_activity_log_resource_type CHECK (resource_type IN (
        'folder', 'item', 'member', 'workspace', 'role'
    )),
    CONSTRAINT ck_activity_log_actor_context CHECK (
        (actor_id IS NULL AND actor_context = 'INVITEE_EMAIL')
        OR (actor_id IS NOT NULL AND actor_context <> 'INVITEE_EMAIL')
    )
);

CREATE INDEX ix_activity_log_workspace_created_at
    ON activity_log (workspace_id, created_at DESC);
CREATE INDEX ix_activity_log_workspace_resource
    ON activity_log (workspace_id, resource_type, resource_id);
CREATE INDEX ix_activity_log_actor_id ON activity_log (actor_id);
