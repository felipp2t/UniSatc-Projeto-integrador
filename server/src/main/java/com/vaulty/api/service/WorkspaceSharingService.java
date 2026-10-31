package com.vaulty.api.service;

import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ForbiddenException;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceSharingService {
    private final JdbcTemplate jdbc;
    private final WorkspaceContentAuthorization authorization;
    private final EffectiveContentAccess access;
    private final WorkspaceRoleRepository roleRepository;

    @Transactional
    public void grantGroup(UUID user, UUID workspace, UUID collection, UUID group) {
        requireManager(user, workspace);
        requireCollection(workspace, collection);
        access.requireCollection(user, authorization.requireWorkspace(user, workspace), collection);
        if (!exists("SELECT EXISTS(SELECT 1 FROM access_group WHERE id=? AND workspace_id=?)", group, workspace))
            throw new ResourceNotFoundException("Grupo não encontrado");
        jdbc.update("INSERT INTO collection_access_grant(collection_id,group_id,workspace_id) VALUES (?,?,?) ON CONFLICT DO NOTHING", collection, group, workspace);
    }

    @Transactional
    public void revokeGroup(UUID user, UUID workspace, UUID collection, UUID group) {
        requireManager(user, workspace); requireCollection(workspace, collection);
        access.requireCollection(user, authorization.requireWorkspace(user, workspace), collection);
        jdbc.update("DELETE FROM collection_access_grant WHERE collection_id=? AND group_id=?", collection, group);
    }

    @Transactional
    public void grantEveryone(UUID user, UUID workspace, UUID collection) {
        requireManager(user, workspace); requireCollection(workspace, collection);
        access.requireCollection(user, authorization.requireWorkspace(user, workspace), collection);
        jdbc.update("INSERT INTO collection_public_grant(collection_id,workspace_id) VALUES (?,?) ON CONFLICT DO NOTHING", collection, workspace);
    }

    @Transactional
    public void revokeEveryone(UUID user, UUID workspace, UUID collection) {
        requireManager(user, workspace); requireCollection(workspace, collection);
        access.requireCollection(user, authorization.requireWorkspace(user, workspace), collection);
        jdbc.update("DELETE FROM collection_public_grant WHERE collection_id=?", collection);
    }

    @Transactional
    public void setInheritance(UUID user, UUID workspace, UUID collection, boolean enabled) {
        requireManager(user, workspace); requireCollection(workspace, collection);
        access.requireCollection(user, authorization.requireWorkspace(user, workspace), collection);
        boolean current = jdbc.queryForObject("SELECT inherit_access FROM collection WHERE id=?", Boolean.class, collection);
        if (current == enabled) return;
        if (!enabled) {
            List<UUID> parentGroups = jdbc.queryForList("""
                    WITH RECURSIVE chain AS (
                        SELECT p.id,p.parent_id,p.inherit_access FROM collection c JOIN collection p ON p.id=c.parent_id WHERE c.id=?
                        UNION ALL SELECT p.id,p.parent_id,p.inherit_access FROM collection p JOIN chain c
                        ON c.parent_id=p.id WHERE c.inherit_access=TRUE
                    ) SELECT DISTINCT g.group_id FROM chain c JOIN collection_access_grant g ON g.collection_id=c.id
                    """, UUID.class, collection);
            parentGroups.forEach(group -> jdbc.update(
                    "INSERT INTO collection_access_grant(collection_id,group_id,workspace_id) VALUES (?,?,?) ON CONFLICT DO NOTHING",
                    collection, group, workspace));
            boolean parentPublic = exists("""
                    WITH RECURSIVE chain AS (
                        SELECT p.id,p.parent_id,p.inherit_access FROM collection c JOIN collection p ON p.id=c.parent_id WHERE c.id=?
                        UNION ALL SELECT p.id,p.parent_id,p.inherit_access FROM collection p JOIN chain c
                        ON c.parent_id=p.id WHERE c.inherit_access=TRUE
                    ) SELECT EXISTS(SELECT 1 FROM chain c JOIN collection_public_grant g ON g.collection_id=c.id)
                    OR EXISTS(SELECT 1 FROM chain WHERE parent_id IS NULL AND inherit_access=TRUE)
                    OR EXISTS(SELECT 1 FROM collection WHERE id=? AND parent_id IS NULL AND inherit_access=TRUE)
                    """, collection, collection);
            if (parentPublic) jdbc.update("INSERT INTO collection_public_grant(collection_id,workspace_id) VALUES (?,?) ON CONFLICT DO NOTHING", collection, workspace);
        }
        jdbc.update("UPDATE collection SET inherit_access=? WHERE id=?", enabled, collection);
    }

    @Transactional
    public void grantMember(UUID user, UUID workspace, UUID item, UUID member) {
        requireManager(user, workspace); requireItem(workspace, item);
        access.requireItem(user, authorization.requireWorkspace(user, workspace), item);
        if (!exists("SELECT EXISTS(SELECT 1 FROM workspace_member WHERE id=? AND workspace_id=?)", member, workspace))
            throw new ResourceNotFoundException("Integrante não encontrado");
        jdbc.update("INSERT INTO item_member_grant(item_id,workspace_member_id,workspace_id) VALUES (?,?,?) ON CONFLICT DO NOTHING", item, member, workspace);
    }

    @Transactional
    public void revokeMember(UUID user, UUID workspace, UUID item, UUID member) {
        requireManager(user, workspace); requireItem(workspace, item);
        access.requireItem(user, authorization.requireWorkspace(user, workspace), item);
        jdbc.update("DELETE FROM item_member_grant WHERE item_id=? AND workspace_member_id=?", item, member);
    }

    @Transactional(readOnly = true)
    public List<String> origins(UUID user, UUID workspaceId, UUID itemId) {
        var workspace = authorization.requireWorkspace(user, workspaceId);
        authorization.require(user, workspace, "item", "read");
        access.requireItem(user, workspace, itemId);
        return access.origins(user, workspaceId, itemId);
    }

    @Transactional(readOnly = true)
    public List<String> collectionOrigins(UUID user, UUID workspaceId, UUID collectionId) {
        var workspace = authorization.requireWorkspace(user, workspaceId);
        authorization.require(user, workspace, "collection", "read");
        access.requireCollection(user, workspace, collectionId);
        return access.collectionOrigins(user, workspaceId, collectionId);
    }

    @Transactional
    public void setRoleSharingPermission(UUID user, UUID workspaceId, UUID roleId, boolean enabled) {
        var workspace = authorization.requireWorkspace(user, workspaceId);
        if (!workspace.getOwner().getId().equals(user))
            throw new ForbiddenException("Somente o dono pode alterar permissões de papéis");
        var role = roleRepository.findByIdAndWorkspaceIdForUpdate(roleId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Papel não encontrado"));
        if ("Owner".equals(role.getName()) || "Member".equals(role.getName()))
            throw new ConflictException("Papéis iniciais não podem ser alterados");
        if (enabled) {
            jdbc.update("INSERT INTO role_permission(role_id,resource,action) VALUES (?,'sharing','manage') ON CONFLICT DO NOTHING", roleId);
        } else {
            jdbc.update("DELETE FROM role_permission WHERE role_id=? AND resource='sharing' AND action='manage'", roleId);
        }
    }

    private void requireManager(UUID user, UUID workspaceId) {
        var workspace = authorization.requireWorkspace(user, workspaceId);
        authorization.require(user, workspace, "sharing", "manage");
    }

    private void requireCollection(UUID workspace, UUID collection) {
        if (!exists("SELECT EXISTS(SELECT 1 FROM collection WHERE id=? AND workspace_id=?)", collection, workspace))
            throw new ResourceNotFoundException("Pasta não encontrada");
    }

    private void requireItem(UUID workspace, UUID item) {
        if (!exists("SELECT EXISTS(SELECT 1 FROM item WHERE id=? AND workspace_id=?)", item, workspace))
            throw new ResourceNotFoundException("Item indisponível");
    }

    private boolean exists(String sql, Object... args) { return Boolean.TRUE.equals(jdbc.queryForObject(sql, Boolean.class, args)); }
}
