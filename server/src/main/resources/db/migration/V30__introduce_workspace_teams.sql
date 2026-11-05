ALTER TABLE workspace_member
    ALTER COLUMN role_id DROP NOT NULL,
    ADD COLUMN team_id UUID,
    ADD CONSTRAINT uq_workspace_member_id_workspace_team UNIQUE (id, workspace_id, team_id);

CREATE TABLE workspace_team (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL,
    name VARCHAR(50) NOT NULL,
    name_key TEXT GENERATED ALWAYS AS (normalize_content_name(name)) STORED,
    root_collection_id UUID NOT NULL,
    leader_member_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT ck_workspace_team_name CHECK (char_length(name) BETWEEN 1 AND 50),
    CONSTRAINT uq_workspace_team_id_workspace UNIQUE (id, workspace_id),
    CONSTRAINT uq_workspace_team_workspace_name UNIQUE (workspace_id, name_key),
    CONSTRAINT uq_workspace_team_root_collection UNIQUE (workspace_id, root_collection_id),
    CONSTRAINT fk_workspace_team_workspace FOREIGN KEY (workspace_id)
        REFERENCES workspace (id) ON DELETE CASCADE,
    CONSTRAINT fk_workspace_team_root_collection FOREIGN KEY (root_collection_id, workspace_id)
        REFERENCES collection (id, workspace_id) ON DELETE RESTRICT,
    CONSTRAINT fk_workspace_team_leader FOREIGN KEY (leader_member_id, workspace_id, id)
        REFERENCES workspace_member (id, workspace_id, team_id)
        DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE workspace_member
    ADD CONSTRAINT fk_workspace_member_team_workspace
        FOREIGN KEY (team_id, workspace_id)
        REFERENCES workspace_team (id, workspace_id)
        ON DELETE SET NULL (team_id)
        DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX ix_workspace_member_team_id ON workspace_member (team_id);
CREATE INDEX ix_workspace_team_leader_member_id ON workspace_team (leader_member_id);

CREATE FUNCTION require_root_collection_for_team() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    collection_parent_id UUID;
BEGIN
    SELECT parent_id INTO collection_parent_id
    FROM collection
    WHERE id = NEW.root_collection_id
      AND workspace_id = NEW.workspace_id
    FOR UPDATE;

    IF NOT FOUND OR collection_parent_id IS NOT NULL THEN
        RAISE EXCEPTION 'A team must reference a root collection in the same workspace';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_workspace_team_root_collection
    BEFORE INSERT OR UPDATE OF root_collection_id, workspace_id ON workspace_team
    FOR EACH ROW EXECUTE FUNCTION require_root_collection_for_team();

CREATE FUNCTION prevent_team_root_collection_nesting() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- The UPDATE holds this collection row lock while checking whether a team
    -- is being attached to the root in a concurrent transaction.
    IF NEW.parent_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM workspace_team
        WHERE root_collection_id = NEW.id
          AND workspace_id = NEW.workspace_id
    ) THEN
        RAISE EXCEPTION 'A team root collection cannot become nested';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_collection_team_root_parent
    BEFORE UPDATE OF parent_id ON collection
    FOR EACH ROW EXECUTE FUNCTION prevent_team_root_collection_nesting();
