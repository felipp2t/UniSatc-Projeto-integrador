CREATE TABLE collection (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL,
    parent_id UUID,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT uq_collection_id_workspace UNIQUE (id, workspace_id),
    CONSTRAINT fk_collection_workspace FOREIGN KEY (workspace_id)
        REFERENCES workspace (id) ON DELETE CASCADE,
    CONSTRAINT fk_collection_parent_workspace FOREIGN KEY (parent_id, workspace_id)
        REFERENCES collection (id, workspace_id) ON DELETE RESTRICT,
    CONSTRAINT uq_collection_workspace_parent_name
        UNIQUE NULLS NOT DISTINCT (workspace_id, parent_id, name)
);

CREATE INDEX ix_collection_parent_id ON collection (parent_id);
