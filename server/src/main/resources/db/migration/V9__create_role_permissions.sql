CREATE TABLE role_permission (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES workspace_role (id) ON DELETE CASCADE,
    resource VARCHAR(30) NOT NULL CHECK (resource IN ('workspace', 'collection', 'item', 'secret', 'member', 'role', 'activity')),
    action VARCHAR(20) NOT NULL CHECK (action IN ('read', 'create', 'update', 'delete', 'invite', 'all')),
    CONSTRAINT uq_role_permission_role_resource_action UNIQUE (role_id, resource, action)
);
