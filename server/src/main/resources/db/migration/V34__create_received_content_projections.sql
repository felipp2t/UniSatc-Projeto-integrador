CREATE TABLE received_content_projection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace (id) ON DELETE CASCADE,
    destination_collection_id UUID NOT NULL,
    original_type VARCHAR(20) NOT NULL CHECK (original_type IN ('ITEM', 'COLLECTION')),
    original_item_id UUID,
    original_collection_id UUID,
    received_parent_collection_id UUID,
    captured_name VARCHAR(255) NOT NULL,
    source_team_name VARCHAR(50) NOT NULL,
    captured_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_received_projection_original CHECK (
        (original_type = 'ITEM' AND original_item_id IS NOT NULL AND original_collection_id IS NULL)
        OR (original_type = 'COLLECTION' AND original_collection_id IS NOT NULL AND original_item_id IS NULL)
    ),
    CONSTRAINT fk_received_projection_destination_workspace
        FOREIGN KEY (destination_collection_id, workspace_id)
        REFERENCES collection (id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_received_projection_item_workspace
        FOREIGN KEY (original_item_id, workspace_id)
        REFERENCES item (id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT ck_received_projection_collection_workspace CHECK (
        original_collection_id IS NULL OR original_type = 'COLLECTION'
    )
);

CREATE UNIQUE INDEX uq_received_projection_item_destination
    ON received_content_projection (destination_collection_id, original_item_id)
    WHERE original_item_id IS NOT NULL;
CREATE UNIQUE INDEX uq_received_projection_collection_destination
    ON received_content_projection (destination_collection_id, original_collection_id)
    WHERE original_collection_id IS NOT NULL;
CREATE INDEX ix_received_projection_destination_path
    ON received_content_projection (workspace_id, destination_collection_id, captured_path, id);
CREATE INDEX ix_received_projection_parent
    ON received_content_projection (destination_collection_id, received_parent_collection_id);

CREATE TABLE received_content_coverage (
    projection_id UUID NOT NULL REFERENCES received_content_projection (id) ON DELETE CASCADE,
    publication_id UUID NOT NULL REFERENCES content_publication (id) ON DELETE CASCADE,
    PRIMARY KEY (projection_id, publication_id)
);
CREATE INDEX ix_received_content_coverage_publication
    ON received_content_coverage (publication_id);

CREATE FUNCTION received_projection_candidates(p_workspace_id UUID, p_destination_collection_id UUID)
RETURNS TABLE (
    publication_id UUID,
    workspace_id UUID,
    destination_collection_id UUID,
    original_type VARCHAR,
    original_item_id UUID,
    original_collection_id UUID,
    received_parent_collection_id UUID,
    captured_name VARCHAR,
    source_team_name VARCHAR,
    captured_path TEXT,
    publication_created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE AS $$
    WITH RECURSIVE published_tree AS (
        SELECT publication.id AS publication_id, publication.workspace_id,
               publication.destination_collection_id, publication.source_team_name,
               publication.captured_path, publication.created_at AS publication_created_at,
               folder.id AS collection_id, NULL::UUID AS parent_collection_id, folder.name
        FROM content_publication publication
        JOIN collection folder ON folder.id = publication.original_collection_id
        WHERE publication.workspace_id = p_workspace_id
          AND (p_destination_collection_id IS NULL
               OR publication.destination_collection_id = p_destination_collection_id)
          AND publication.original_type = 'COLLECTION'
        UNION ALL
        SELECT tree.publication_id, tree.workspace_id, tree.destination_collection_id,
               tree.source_team_name, tree.captured_path, tree.publication_created_at,
               child.id, tree.collection_id, child.name
        FROM collection child JOIN published_tree tree ON child.parent_id = tree.collection_id
        WHERE child.workspace_id = p_workspace_id
    )
    SELECT publication.id, publication.workspace_id, publication.destination_collection_id,
           'ITEM'::VARCHAR, publication.original_item_id, NULL::UUID, NULL::UUID, item.title, publication.source_team_name,
           publication.captured_path, publication.created_at
    FROM content_publication publication JOIN item ON item.id = publication.original_item_id
    WHERE publication.workspace_id = p_workspace_id
      AND (p_destination_collection_id IS NULL
           OR publication.destination_collection_id = p_destination_collection_id)
      AND publication.original_type = 'ITEM'
    UNION ALL
    SELECT tree.publication_id, tree.workspace_id, tree.destination_collection_id,
           'ITEM'::VARCHAR, item.id, NULL::UUID, tree.collection_id, item.title, tree.source_team_name,
           tree.captured_path, tree.publication_created_at
    FROM published_tree tree JOIN item ON item.collection_id = tree.collection_id
    WHERE item.workspace_id = p_workspace_id
    UNION ALL
    SELECT tree.publication_id, tree.workspace_id, tree.destination_collection_id,
           'COLLECTION'::VARCHAR, NULL::UUID, tree.collection_id, tree.parent_collection_id, tree.name,
           tree.source_team_name, tree.captured_path, tree.publication_created_at
    FROM published_tree tree
$$;

CREATE FUNCTION refresh_received_content_projection(p_workspace_id UUID, p_destination_collection_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO received_content_projection (
        workspace_id, destination_collection_id, original_type, original_item_id,
        original_collection_id, received_parent_collection_id, captured_name, source_team_name, captured_path
    )
    SELECT DISTINCT ON (candidate.destination_collection_id, candidate.original_type,
                        candidate.original_item_id, candidate.original_collection_id)
           candidate.workspace_id, candidate.destination_collection_id, candidate.original_type,
           candidate.original_item_id, candidate.original_collection_id,
           candidate.received_parent_collection_id,
           candidate.captured_name, candidate.source_team_name, candidate.captured_path
    FROM received_projection_candidates(p_workspace_id, p_destination_collection_id) candidate
    WHERE NOT EXISTS (
        SELECT 1 FROM received_content_projection existing
        WHERE existing.destination_collection_id = candidate.destination_collection_id
          AND existing.original_type = candidate.original_type
          AND existing.original_item_id IS NOT DISTINCT FROM candidate.original_item_id
          AND existing.original_collection_id IS NOT DISTINCT FROM candidate.original_collection_id
    )
    ORDER BY candidate.destination_collection_id, candidate.original_type,
             candidate.original_item_id, candidate.original_collection_id,
             candidate.publication_created_at, candidate.publication_id;

    INSERT INTO received_content_coverage (projection_id, publication_id)
    SELECT DISTINCT projection.id, candidate.publication_id
    FROM received_projection_candidates(p_workspace_id, p_destination_collection_id) candidate
    JOIN received_content_projection projection
      ON projection.destination_collection_id = candidate.destination_collection_id
     AND projection.original_type = candidate.original_type
     AND projection.original_item_id IS NOT DISTINCT FROM candidate.original_item_id
     AND projection.original_collection_id IS NOT DISTINCT FROM candidate.original_collection_id
    ON CONFLICT DO NOTHING;

    DELETE FROM received_content_coverage coverage
    USING received_content_projection projection
    WHERE coverage.projection_id = projection.id
      AND projection.workspace_id = p_workspace_id
      AND (p_destination_collection_id IS NULL
           OR projection.destination_collection_id = p_destination_collection_id)
      AND projection.original_type = 'COLLECTION'
      AND NOT EXISTS (
          SELECT 1 FROM collection folder
          WHERE folder.id = projection.original_collection_id
            AND folder.workspace_id = projection.workspace_id
      );

    LOOP
        DELETE FROM received_content_projection projection
        WHERE projection.workspace_id = p_workspace_id
          AND (p_destination_collection_id IS NULL
               OR projection.destination_collection_id = p_destination_collection_id)
          AND NOT EXISTS (
              SELECT 1 FROM received_content_coverage coverage
              WHERE coverage.projection_id = projection.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM received_content_projection child
              WHERE child.destination_collection_id = projection.destination_collection_id
                AND child.received_parent_collection_id = projection.original_collection_id
          );
        EXIT WHEN NOT FOUND;
    END LOOP;
END;
$$;
