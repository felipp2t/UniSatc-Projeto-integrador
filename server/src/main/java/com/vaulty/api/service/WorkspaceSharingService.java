package com.vaulty.api.service;

import com.vaulty.api.dto.notification.NotificationResourceReference;
import com.vaulty.api.dto.accessgroup.AccessGroupResponse;
import com.vaulty.api.dto.sharing.CollectionSharingConfiguration;
import com.vaulty.api.dto.sharing.ItemSharingConfiguration;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ForbiddenException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import com.vaulty.api.repository.AccessGroupRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
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
    private final AccessGroupRepository groupRepository;
    private final WorkspaceMemberRepository memberRepository;
    private final WorkspaceAccessNotifications accessNotifications;
    private final NotificationService notifications;

    @Transactional
    public void grantGroup(UUID user, UUID workspace, UUID collection, UUID group) {
        requireManager(user, workspace);
        requireCollection(workspace, collection);
        access.requireCollection(user, authorization.requireWorkspace(user, workspace), collection);
        if (!exists("SELECT EXISTS(SELECT 1 FROM access_group WHERE id=? AND workspace_id=?)", group, workspace))
            throw new ResourceNotFoundException("Grupo não encontrado");
        var before = accessNotifications.snapshot(workspace);
        if (jdbc.update("INSERT INTO collection_access_grant(collection_id,group_id,workspace_id) VALUES (?,?,?) ON CONFLICT DO NOTHING", collection, group, workspace) > 0)
            accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspace),
                    new NotificationResourceReference(workspace, NotificationResourceReference.Type.COLLECTION, collection));
    }

    @Transactional
    public void revokeGroup(UUID user, UUID workspace, UUID collection, UUID group) {
        requireManager(user, workspace); requireCollection(workspace, collection);
        access.requireCollection(user, authorization.requireWorkspace(user, workspace), collection);
        var before = accessNotifications.snapshot(workspace);
        if (jdbc.update("DELETE FROM collection_access_grant WHERE collection_id=? AND group_id=?", collection, group) > 0)
            accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspace),
                    new NotificationResourceReference(workspace, NotificationResourceReference.Type.COLLECTION, collection));
    }

    @Transactional
    public void grantEveryone(UUID user, UUID workspace, UUID collection) {
        requireManager(user, workspace); requireCollection(workspace, collection);
        access.requireCollection(user, authorization.requireWorkspace(user, workspace), collection);
        var before = accessNotifications.snapshot(workspace);
        if (jdbc.update("INSERT INTO collection_public_grant(collection_id,workspace_id) VALUES (?,?) ON CONFLICT DO NOTHING", collection, workspace) > 0)
            accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspace),
                    new NotificationResourceReference(workspace, NotificationResourceReference.Type.COLLECTION, collection));
    }

    @Transactional
    public void revokeEveryone(UUID user, UUID workspace, UUID collection) {
        requireManager(user, workspace); requireCollection(workspace, collection);
        access.requireCollection(user, authorization.requireWorkspace(user, workspace), collection);
        var before = accessNotifications.snapshot(workspace);
        if (jdbc.update("DELETE FROM collection_public_grant WHERE collection_id=?", collection) > 0)
            accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspace),
                    new NotificationResourceReference(workspace, NotificationResourceReference.Type.COLLECTION, collection));
    }

    @Transactional
    public void setInheritance(UUID user, UUID workspace, UUID collection, boolean enabled) {
        requireManager(user, workspace); requireCollection(workspace, collection);
        access.requireCollection(user, authorization.requireWorkspace(user, workspace), collection);
        boolean current = jdbc.queryForObject("SELECT inherit_access FROM collection WHERE id=?", Boolean.class, collection);
        if (current == enabled) return;
        var before = accessNotifications.snapshot(workspace);
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
        accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspace),
                new NotificationResourceReference(workspace, NotificationResourceReference.Type.COLLECTION, collection));
    }

    @Transactional
    public void grantMember(UUID user, UUID workspace, UUID item, UUID member) {
        requireManager(user, workspace); requireItem(workspace, item);
        requireItemSharingAccess(user, workspace, item);
        if (!exists("SELECT EXISTS(SELECT 1 FROM workspace_member WHERE id=? AND workspace_id=?)", member, workspace))
            throw new ResourceNotFoundException("Integrante não encontrado");
        var before = accessNotifications.snapshot(workspace);
        if (jdbc.update("INSERT INTO item_member_grant(item_id,workspace_member_id,workspace_id) VALUES (?,?,?) ON CONFLICT DO NOTHING", item, member, workspace) > 0)
            accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspace),
                    new NotificationResourceReference(workspace, NotificationResourceReference.Type.ITEM, item));
    }

    @Transactional
    public void revokeMember(UUID user, UUID workspace, UUID item, UUID member) {
        requireManager(user, workspace); requireItem(workspace, item);
        requireItemSharingAccess(user, workspace, item);
        var before = accessNotifications.snapshot(workspace);
        if (jdbc.update("DELETE FROM item_member_grant WHERE item_id=? AND workspace_member_id=?", item, member) > 0)
        accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspace),
                new NotificationResourceReference(workspace, NotificationResourceReference.Type.ITEM, item));
    }

    @Transactional(readOnly = true)
    public CollectionSharingConfiguration collectionConfiguration(UUID user, UUID workspaceId, UUID collectionId) {
        requireSharingTarget(user, workspaceId, "collection", collectionId);
        boolean inherit = jdbc.queryForObject("SELECT inherit_access FROM collection WHERE id=?", Boolean.class, collectionId);
        boolean publicGrant = exists("SELECT EXISTS(SELECT 1 FROM collection_public_grant WHERE collection_id=?)", collectionId);
        List<AccessGroupResponse> groups = groupRepository.findAllByWorkspaceIdOrderByNameAscIdAsc(workspaceId).stream()
                .map(group -> new AccessGroupResponse(group.getId(), group.getName())).toList();
        List<AccessGroupResponse> granted = jdbc.query("SELECT g.id,g.name FROM access_group g JOIN collection_access_grant cg ON cg.group_id=g.id WHERE cg.collection_id=? ORDER BY g.name,g.id",
                (rs, row) -> new AccessGroupResponse(rs.getObject("id", UUID.class), rs.getString("name")), collectionId);
        return new CollectionSharingConfiguration(inherit, publicGrant, groups, granted);
    }

    @Transactional(readOnly = true)
    public ItemSharingConfiguration itemConfiguration(UUID user, UUID workspaceId, UUID itemId) {
        requireSharingTarget(user, workspaceId, "item", itemId);
        List<ItemSharingConfiguration.MemberGrant> eligible = memberRepository.findAllVisibleToMember(workspaceId, user).stream()
                .map(member -> new ItemSharingConfiguration.MemberGrant(member.getId(), member.getUser().getName())).toList();
        List<ItemSharingConfiguration.MemberGrant> granted = jdbc.query("SELECT wm.id,u.name FROM item_member_grant ig JOIN workspace_member wm ON wm.id=ig.workspace_member_id JOIN \"user\" u ON u.id=wm.user_id WHERE ig.item_id=? ORDER BY u.name,wm.id",
                (rs, row) -> new ItemSharingConfiguration.MemberGrant(rs.getObject("id", UUID.class), rs.getString("name")), itemId);
        return new ItemSharingConfiguration(eligible, granted);
    }

    private void requireSharingTarget(UUID user, UUID workspaceId, String type, UUID id) {
        var workspace = authorization.requireWorkspace(user, workspaceId);
        authorization.require(user, workspace, "sharing", "manage");
        if ("collection".equals(type)) {
            requireCollection(workspaceId, id);
            access.requireCollection(user, workspace, id);
        } else {
            requireItem(workspaceId, id);
            requireItemSharingAccess(user, workspaceId, id);
        }
    }

    @Transactional(readOnly = true)
    public List<String> origins(UUID user, UUID workspaceId, UUID itemId, UUID memberId) {
        var workspace = authorization.requireWorkspace(user, workspaceId);
        if (memberId == null) {
            authorization.require(user, workspace, "item", "read");
            requireItemSharingAccess(user, workspaceId, itemId);
            return access.origins(user, workspaceId, itemId);
        }
        authorization.require(user, workspace, "sharing", "manage");
        requireItem(workspaceId, itemId);
        requireItemSharingAccess(user, workspaceId, itemId);
        var member = memberRepository.findByIdAndWorkspaceId(memberId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Integrante não encontrado"));
        return access.origins(member.getUser().getId(), workspaceId, itemId);
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
        accessNotifications.lockWorkspace(workspaceId);
        var workspace = authorization.requireWorkspace(user, workspaceId);
        if (!workspace.getOwner().getId().equals(user))
            throw new ForbiddenException("Somente o dono pode alterar permissões de papéis");
        var role = roleRepository.findByIdAndWorkspaceIdForUpdate(roleId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Papel não encontrado"));
        if ("Owner".equals(role.getName()) || "Member".equals(role.getName()))
            throw new ConflictException("Papéis iniciais não podem ser alterados");
        List<UUID> affected = jdbc.queryForList(
                "SELECT user_id FROM workspace_member WHERE workspace_id=? AND role_id=?", UUID.class, workspaceId, roleId);
        int changed;
        if (enabled) {
            changed = jdbc.update("INSERT INTO role_permission(role_id,resource,action) VALUES (?,'sharing','manage') ON CONFLICT DO NOTHING", roleId);
        } else {
            changed = jdbc.update("DELETE FROM role_permission WHERE role_id=? AND resource='sharing' AND action='manage'", roleId);
        }
        if (changed > 0) notifications.accessChanged(affected);
    }

    private void requireManager(UUID user, UUID workspaceId) {
        accessNotifications.lockWorkspace(workspaceId);
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

    private void requireItemSharingAccess(UUID user, UUID workspaceId, UUID itemId) {
        var workspace = authorization.requireWorkspace(user, workspaceId);
        access.requireItem(user, workspace, itemId);
        if (exists("SELECT EXISTS(SELECT 1 FROM item WHERE id=? AND type='secret')", itemId)
                && !authorization.allows(user, workspace, "secret", "read"))
            throw new ResourceNotFoundException("Item indisponível");
    }

    private boolean exists(String sql, Object... args) { return Boolean.TRUE.equals(jdbc.queryForObject(sql, Boolean.class, args)); }
}
