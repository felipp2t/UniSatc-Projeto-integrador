INSERT INTO role_permission (role_id, resource, action)
SELECT role.id, resource.name, 'read'
FROM workspace_role role
CROSS JOIN (VALUES ('item'), ('collection')) AS resource(name)
WHERE role.name = 'Member'
ON CONFLICT (role_id, resource, action) DO NOTHING;
