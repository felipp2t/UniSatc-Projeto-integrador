INSERT INTO workspace_role (id, workspace_id, name)
SELECT gen_random_uuid(), id, 'Member' FROM workspace
ON CONFLICT (workspace_id, name) DO NOTHING;
