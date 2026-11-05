CREATE TABLE content_publication (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
    original_type VARCHAR(20) NOT NULL CHECK (original_type IN ('ITEM', 'COLLECTION')),
    original_item_id UUID,
    original_collection_id UUID,
    source_collection_id UUID NOT NULL,
    destination_collection_id UUID NOT NULL,
    source_team_name VARCHAR(50) NOT NULL,
    captured_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_content_publication_original CHECK (
        (original_type = 'ITEM' AND original_item_id IS NOT NULL AND original_collection_id IS NULL)
        OR (original_type = 'COLLECTION' AND original_collection_id IS NOT NULL AND original_item_id IS NULL)
    ),
    CONSTRAINT fk_content_publication_item_workspace FOREIGN KEY (original_item_id, workspace_id)
        REFERENCES item (id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_content_publication_collection_workspace FOREIGN KEY (original_collection_id, workspace_id)
        REFERENCES collection (id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_content_publication_source_workspace FOREIGN KEY (source_collection_id, workspace_id)
        REFERENCES collection (id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_content_publication_destination_workspace FOREIGN KEY (destination_collection_id, workspace_id)
        REFERENCES collection (id, workspace_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_content_publication_item_destination
    ON content_publication (original_item_id, destination_collection_id)
    WHERE original_item_id IS NOT NULL;
CREATE UNIQUE INDEX uq_content_publication_collection_destination
    ON content_publication (original_collection_id, destination_collection_id)
    WHERE original_collection_id IS NOT NULL;
CREATE INDEX ix_content_publication_source
    ON content_publication (workspace_id, source_collection_id, created_at DESC);
