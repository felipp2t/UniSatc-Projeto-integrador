package com.vaulty.api.service;

import com.vaulty.api.entity.Workspace;
import com.vaulty.api.exception.ResourceNotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;

@Service
public class EffectiveContentAccess {

    private final JdbcTemplate jdbc;

    public EffectiveContentAccess(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean canReadCollection(UUID userId, Workspace workspace, UUID collectionId) {
        if (workspace.getOwner().getId().equals(userId)) return true;
        if (!isMember(workspace.getId(), userId)) throw new ResourceNotFoundException("Workspace não encontrado");
        if (collectionId == null) return true;
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                WITH RECURSIVE chain AS (
                    SELECT id, parent_id, inherit_access FROM collection
                    WHERE id = ? AND workspace_id = ?
                    UNION ALL
                    SELECT parent.id, parent.parent_id, parent.inherit_access
                    FROM collection parent JOIN chain child ON child.parent_id = parent.id
                    WHERE parent.workspace_id = ? AND child.inherit_access = TRUE
                )
                SELECT EXISTS (
                    SELECT 1 FROM chain c JOIN collection_public_grant g ON g.collection_id = c.id
                    UNION ALL SELECT 1 FROM chain WHERE parent_id IS NULL AND inherit_access = TRUE
                    UNION ALL
                    SELECT 1 FROM chain c JOIN collection_access_grant g ON g.collection_id = c.id
                    JOIN access_group_member gm ON gm.group_id = g.group_id
                    JOIN workspace_member wm ON wm.id = gm.workspace_member_id
                    WHERE wm.user_id = ? AND wm.workspace_id = ?
                )
                """, Boolean.class, collectionId, workspace.getId(), workspace.getId(), userId, workspace.getId()));
    }

    public boolean canReadItem(UUID userId, Workspace workspace, UUID itemId) {
        if (workspace.getOwner().getId().equals(userId)) return true;
        if (!isMember(workspace.getId(), userId)) throw new ResourceNotFoundException("Workspace não encontrado");
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM item i WHERE i.id = ? AND i.workspace_id = ? AND
                    (i.collection_id IS NULL OR EXISTS (
                        WITH RECURSIVE chain AS (
                            SELECT id, parent_id, inherit_access FROM collection WHERE id = i.collection_id
                            UNION ALL SELECT p.id, p.parent_id, p.inherit_access FROM collection p
                            JOIN chain c ON c.parent_id = p.id WHERE c.inherit_access = TRUE
                        )
                        SELECT 1 FROM chain c JOIN collection_public_grant g ON g.collection_id = c.id
                        UNION ALL SELECT 1 FROM chain WHERE parent_id IS NULL AND inherit_access = TRUE
                        UNION ALL SELECT 1 FROM chain c JOIN collection_access_grant g ON g.collection_id = c.id
                        JOIN access_group_member gm ON gm.group_id = g.group_id
                        JOIN workspace_member wm ON wm.id = gm.workspace_member_id
                        WHERE wm.user_id = ? AND wm.workspace_id = ?
                    ))
                ) OR EXISTS (
                    SELECT 1 FROM item_member_grant g JOIN workspace_member wm ON wm.id = g.workspace_member_id
                    WHERE g.item_id = ? AND wm.user_id = ? AND wm.workspace_id = ?
                )
                """, Boolean.class, itemId, workspace.getId(), userId, workspace.getId(), itemId, userId, workspace.getId()));
    }

    public void requireCollection(UUID userId, Workspace workspace, UUID collectionId) {
        if (collectionId != null && !Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM collection WHERE id=? AND workspace_id=?)", Boolean.class,
                collectionId, workspace.getId()))) throw new ResourceNotFoundException("Pasta não encontrada");
        if (!canReadCollection(userId, workspace, collectionId)) throw new ResourceNotFoundException("Pasta não encontrada");
    }

    public void requireItem(UUID userId, Workspace workspace, UUID itemId) {
        if (!Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM item WHERE id=? AND workspace_id=?)", Boolean.class,
                itemId, workspace.getId()))) throw new ResourceNotFoundException("Item indisponível");
        if (!canReadItem(userId, workspace, itemId)) throw new ResourceNotFoundException("Item indisponível");
    }

    public List<String> origins(UUID userId, UUID workspaceId, UUID itemId) {
        return jdbc.queryForList("""
                WITH RECURSIVE item_collection AS (
                    SELECT c.id, c.parent_id, c.inherit_access FROM item i JOIN collection c ON c.id = i.collection_id
                    WHERE i.id = ? AND i.workspace_id = ?
                    UNION ALL SELECT p.id, p.parent_id, p.inherit_access FROM collection p JOIN item_collection c
                    ON c.parent_id = p.id WHERE c.inherit_access = TRUE
                )
                SELECT 'member:' || g.workspace_member_id FROM item_member_grant g
                    JOIN workspace_member wm ON wm.id=g.workspace_member_id
                    WHERE g.item_id = ? AND wm.user_id=? AND wm.workspace_id=?
                UNION ALL SELECT 'public:collection:' || g.collection_id::text FROM item_collection c
                    JOIN collection_public_grant g ON g.collection_id = c.id
                UNION ALL SELECT 'public:workspace-root' WHERE EXISTS(
                    SELECT 1 FROM item_collection WHERE parent_id IS NULL AND inherit_access = TRUE)
                UNION ALL SELECT 'public:workspace-root' WHERE EXISTS(
                    SELECT 1 FROM item i WHERE i.id=? AND i.workspace_id=? AND i.collection_id IS NULL)
                UNION ALL SELECT 'group:' || g.group_id::text FROM item_collection c
                    JOIN collection_access_grant g ON g.collection_id = c.id
                    JOIN access_group_member gm ON gm.group_id=g.group_id
                    JOIN workspace_member wm ON wm.id=gm.workspace_member_id
                    WHERE wm.user_id=? AND wm.workspace_id=?
                """, String.class, itemId, workspaceId, itemId, userId, workspaceId,
                itemId, workspaceId, userId, workspaceId);
    }

    public List<String> collectionOrigins(UUID userId, UUID workspaceId, UUID collectionId) {
        return jdbc.queryForList("""
                WITH RECURSIVE chain AS (
                    SELECT id,parent_id,inherit_access FROM collection WHERE id=? AND workspace_id=?
                    UNION ALL SELECT p.id,p.parent_id,p.inherit_access FROM collection p JOIN chain c
                    ON c.parent_id=p.id WHERE p.workspace_id=? AND c.inherit_access=TRUE
                )
                SELECT 'public:collection:' || g.collection_id::text FROM chain c
                    JOIN collection_public_grant g ON g.collection_id=c.id
                UNION ALL SELECT 'public:workspace-root' WHERE EXISTS(
                    SELECT 1 FROM chain WHERE parent_id IS NULL AND inherit_access = TRUE)
                UNION ALL SELECT 'group:' || g.group_id::text FROM chain c
                    JOIN collection_access_grant g ON g.collection_id=c.id
                    JOIN access_group_member gm ON gm.group_id=g.group_id
                    JOIN workspace_member wm ON wm.id=gm.workspace_member_id
                    WHERE wm.user_id=? AND wm.workspace_id=?
                """, String.class, collectionId, workspaceId, workspaceId, userId, workspaceId);
    }

    private boolean isMember(UUID workspaceId, UUID userId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM workspace_member WHERE workspace_id = ? AND user_id = ?)",
                Boolean.class, workspaceId, userId));
    }
}
