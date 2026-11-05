ALTER TABLE activity_log
    DROP CONSTRAINT ck_activity_log_action,
    DROP CONSTRAINT ck_activity_log_resource_type,
    ADD CONSTRAINT ck_activity_log_action CHECK (action IN (
        'folder_created', 'folder_renamed', 'folder_deleted',
        'item_created', 'item_updated', 'item_archived', 'item_restored', 'item_deleted',
        'member_invited', 'member_joined', 'member_role_changed', 'member_removed',
        'member_invite_revoked', 'member_invite_declined', 'workspace_renamed',
        'role_created', 'role_renamed', 'role_deleted', 'role_permissions_changed',
        'group_created', 'group_renamed', 'group_deleted', 'group_member_added', 'group_member_removed',
        'team_created', 'team_renamed', 'team_deleted', 'team_member_added', 'team_member_removed',
        'team_leader_changed'
    )),
    ADD CONSTRAINT ck_activity_log_resource_type CHECK (resource_type IN (
        'folder', 'item', 'member', 'workspace', 'role', 'group', 'team'
    ));

ALTER TABLE role_permission
    DROP CONSTRAINT role_permission_resource_check,
    ADD CONSTRAINT role_permission_resource_check
        CHECK (resource IN ('workspace', 'collection', 'item', 'secret', 'member', 'role', 'activity', 'group', 'sharing', 'team'));
