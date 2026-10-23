CREATE TABLE activity_log (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    actor_context VARCHAR(32) NOT NULL,
    action VARCHAR(80) NOT NULL,
    resource_type VARCHAR(40) NOT NULL,
    resource_id UUID NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_activity_log_workspace_created_at
    ON activity_log (workspace_id, created_at DESC);
CREATE INDEX ix_activity_log_workspace_resource
    ON activity_log (workspace_id, resource_type, resource_id);
CREATE INDEX ix_activity_log_actor_id ON activity_log (actor_id);
