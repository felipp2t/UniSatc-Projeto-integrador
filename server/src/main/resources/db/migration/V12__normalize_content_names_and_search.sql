-- A mesma identidade normalizada rege a unicidade e a busca, preservando a apresentação.
CREATE FUNCTION normalize_content_name(value TEXT) RETURNS TEXT
    LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE
    AS $$
        SELECT lower(regexp_replace(normalize(btrim(value, E' \t\n\r\f'), NFD), U&'[\0300-\036F]', '', 'g'))
    $$;

ALTER TABLE item
    ADD COLUMN title_key TEXT GENERATED ALWAYS AS (normalize_content_name(title)) STORED,
    ADD COLUMN title_search TSVECTOR GENERATED ALWAYS AS
        (to_tsvector('simple', normalize_content_name(title))) STORED;

ALTER TABLE collection
    ADD COLUMN name_key TEXT GENERATED ALWAYS AS (normalize_content_name(name)) STORED;

-- Duplicatas legadas precisam de decisão humana; a migração não renomeia nem exclui conteúdo.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM item
        GROUP BY workspace_id, collection_id, title_key HAVING count(*) > 1
    ) OR EXISTS (
        SELECT 1 FROM collection
        GROUP BY workspace_id, parent_id, name_key HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Nomes equivalentes na mesma localização; regularize manualmente antes de migrar';
    END IF;
END $$;

ALTER TABLE item
    DROP CONSTRAINT uq_item_workspace_collection_title,
    ADD CONSTRAINT uq_item_workspace_collection_title
        UNIQUE NULLS NOT DISTINCT (workspace_id, collection_id, title_key);

ALTER TABLE collection
    DROP CONSTRAINT uq_collection_workspace_parent_name,
    ADD CONSTRAINT uq_collection_workspace_parent_name
        UNIQUE NULLS NOT DISTINCT (workspace_id, parent_id, name_key);

DROP INDEX ix_item_active_title_trgm;
CREATE INDEX ix_item_active_title_search ON item USING GIN (title_search) WHERE archived_at IS NULL;
