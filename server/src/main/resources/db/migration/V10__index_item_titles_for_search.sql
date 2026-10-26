CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX ix_item_active_title_trgm
    ON item USING GIN (lower(title) gin_trgm_ops)
    WHERE archived_at IS NULL;
