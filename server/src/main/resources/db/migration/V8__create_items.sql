CREATE TABLE item (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
    collection_id UUID,
    type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'link', 'file', 'image', 'video', 'secret')),
    title VARCHAR(255) NOT NULL,
    text_content TEXT,
    link_url VARCHAR(2048),
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT fk_item_collection_workspace FOREIGN KEY (collection_id, workspace_id)
        REFERENCES collection (id, workspace_id) ON DELETE RESTRICT,
    CONSTRAINT uq_item_workspace_collection_title
        UNIQUE NULLS NOT DISTINCT (workspace_id, collection_id, title),
    CONSTRAINT ck_item_inline_content CHECK (
        (type = 'text' AND link_url IS NULL)
        OR (type = 'link' AND text_content IS NULL AND link_url IS NOT NULL AND link_url ~ '^https?://')
        OR (type IN ('file', 'image', 'video', 'secret') AND text_content IS NULL AND link_url IS NULL)
    )
);

CREATE INDEX ix_item_collection_id ON item (collection_id);
CREATE INDEX ix_item_workspace_type ON item (workspace_id, type);
CREATE INDEX ix_item_workspace_archived_at ON item (workspace_id, archived_at);

CREATE TABLE item_secret (
    item_id UUID PRIMARY KEY REFERENCES item (id) ON DELETE CASCADE,
    value TEXT NOT NULL
);
