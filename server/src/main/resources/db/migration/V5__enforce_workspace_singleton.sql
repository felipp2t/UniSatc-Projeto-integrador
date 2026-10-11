DO $$
BEGIN
    IF (SELECT count(*) FROM workspace) > 1 THEN
        RAISE EXCEPTION 'workspace: % registros encontrados, regularize manualmente para exatamente um antes de aplicar esta migration', (SELECT count(*) FROM workspace);
    END IF;
END $$;

ALTER TABLE workspace ADD COLUMN singleton BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE workspace ADD CONSTRAINT ck_workspace_singleton CHECK (singleton = TRUE);
ALTER TABLE workspace ADD CONSTRAINT uq_workspace_singleton UNIQUE (singleton);

INSERT INTO workspace (id, owner_id, name)
SELECT gen_random_uuid(), 'afd23ecc-4abb-4e2b-b985-3aaa8637a839', 'Vaulty'
WHERE NOT EXISTS (SELECT 1 FROM workspace);

INSERT INTO workspace_role (id, workspace_id, name)
SELECT gen_random_uuid(), id, 'Owner' FROM workspace
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO workspace_member (id, user_id, workspace_id, role_id)
SELECT gen_random_uuid(), workspace.owner_id, workspace.id, role.id
FROM workspace
JOIN workspace_role role ON role.workspace_id = workspace.id AND role.name = 'Owner'
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id;
