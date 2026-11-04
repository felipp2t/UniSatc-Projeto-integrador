-- Nomes de papéis seguem a mesma identidade normalizada de pastas, itens e grupos (RN05).
ALTER TABLE workspace_role
    ADD COLUMN name_key TEXT GENERATED ALWAYS AS (normalize_content_name(name)) STORED,
    ADD CONSTRAINT ck_workspace_role_name CHECK (char_length(name) BETWEEN 1 AND 50),
    ADD CONSTRAINT ck_workspace_role_builtin_names CHECK (
        name_key NOT IN ('owner', 'member') OR name IN ('Owner', 'Member')
    ),
    DROP CONSTRAINT uq_workspace_role_workspace_name,
    ADD CONSTRAINT uq_workspace_role_workspace_name UNIQUE (workspace_id, name_key);
