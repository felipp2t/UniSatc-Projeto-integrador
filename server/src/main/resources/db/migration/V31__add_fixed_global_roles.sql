ALTER TABLE workspace_member
    ADD COLUMN global_role VARCHAR(20),
    ADD CONSTRAINT ck_workspace_member_global_role
        CHECK (global_role IS NULL OR global_role IN ('ADMIN', 'MAINTAINER')),
    ADD CONSTRAINT ck_workspace_member_global_role_without_team
        CHECK (global_role IS NULL OR team_id IS NULL);

CREATE FUNCTION require_global_workspace_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- UPDATE already owns the workspace row lock shared with membership changes.
    IF EXISTS (
        SELECT 1 FROM workspace_member member
        WHERE member.workspace_id = NEW.id
          AND member.user_id = NEW.owner_id
          AND (member.team_id IS NOT NULL OR member.global_role IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'A workspace owner cannot have a team or another global role';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_workspace_owner_without_team
    BEFORE INSERT OR UPDATE OF owner_id ON workspace
    FOR EACH ROW EXECUTE FUNCTION require_global_workspace_owner();

CREATE FUNCTION prevent_workspace_owner_team_membership() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    current_owner_id UUID;
BEGIN
    SELECT owner_id INTO current_owner_id
    FROM workspace
    WHERE id = NEW.workspace_id
    FOR UPDATE;

    IF (NEW.team_id IS NOT NULL OR NEW.global_role IS NOT NULL)
        AND current_owner_id = NEW.user_id THEN
        RAISE EXCEPTION 'A workspace owner cannot have a team or another global role';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_workspace_member_owner_without_team
    BEFORE INSERT OR UPDATE OF user_id, workspace_id, team_id, global_role ON workspace_member
    FOR EACH ROW EXECUTE FUNCTION prevent_workspace_owner_team_membership();
