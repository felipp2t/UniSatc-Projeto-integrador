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
VALUES ('11111111-1111-1111-1111-111111111111', 'afd23ecc-4abb-4e2b-b985-3aaa8637a839', 'Vaulty');

INSERT INTO workspace_role (id, workspace_id, name)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Owner');

INSERT INTO workspace_member (id, user_id, workspace_id, role_id)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    'afd23ecc-4abb-4e2b-b985-3aaa8637a839',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
);
