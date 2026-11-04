-- O administrador geral acessa todos os workspaces sem ser membro de nenhum deles.
ALTER TABLE refresh_token
    ALTER COLUMN workspace_member_id DROP NOT NULL;

-- Outro dono assume o workspace; sem outro dono, ele fica aguardando o convite de um proprietário.
UPDATE workspace w
SET owner_id = (
    SELECT member.user_id
    FROM workspace_member member
    JOIN workspace_role role ON role.id = member.role_id
    JOIN "user" u ON u.id = member.user_id
    WHERE member.workspace_id = w.id AND role.name = 'Owner' AND NOT u.system_admin
    ORDER BY member.created_at, member.id
    LIMIT 1
)
WHERE w.owner_id IN (SELECT id FROM "user" WHERE system_admin);

DELETE FROM workspace_member
WHERE user_id IN (SELECT id FROM "user" WHERE system_admin);
