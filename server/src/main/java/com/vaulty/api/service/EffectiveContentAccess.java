package com.vaulty.api.service;

import com.vaulty.api.entity.Workspace;
import com.vaulty.api.exception.ResourceNotFoundException;
import java.util.HashMap;
import java.util.HashSet;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class EffectiveContentAccess {

    private final JdbcTemplate jdbc;

    public EffectiveContentAccess(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<UUID, Set<String>> readableResourcesByMember(UUID workspaceId) {
        return jdbc.query("""
                WITH RECURSIVE workspace_row AS (
                    SELECT id, owner_id FROM workspace WHERE id = ?
                ), members AS (
                    SELECT wm.id, wm.user_id FROM workspace_member wm
                    JOIN workspace_row w ON w.id = wm.workspace_id
                ), collections AS (
                    SELECT c.id, c.parent_id, c.inherit_access FROM collection c
                    JOIN workspace_row w ON w.id = c.workspace_id
                ), items AS (
                    SELECT i.id, i.collection_id FROM item i
                    JOIN workspace_row w ON w.id = i.workspace_id
                ), collection_chain(collection_id, ancestor_id, parent_id, inherit_access) AS (
                    SELECT id, id, parent_id, inherit_access FROM collections
                    UNION ALL
                    SELECT chain.collection_id, parent.id, parent.parent_id, parent.inherit_access
                    FROM collection_chain chain JOIN collections parent ON parent.id = chain.parent_id
                    WHERE chain.inherit_access = TRUE
                ), collection_access(user_id, collection_id) AS (
                    SELECT m.user_id, c.id FROM members m CROSS JOIN collections c
                    JOIN workspace_row w ON w.owner_id = m.user_id
                    UNION
                    SELECT m.user_id, chain.collection_id
                    FROM members m
                    JOIN access_group_member gm ON gm.workspace_member_id = m.id
                    JOIN collection_access_grant g ON g.group_id = gm.group_id
                    JOIN collection_chain chain ON chain.ancestor_id = g.collection_id
                    UNION
                    SELECT m.user_id, chain.collection_id
                    FROM members m
                    JOIN collection_chain chain ON TRUE
                    JOIN collection_public_grant g ON g.collection_id = chain.ancestor_id
                    UNION
                    SELECT m.user_id, chain.collection_id FROM members m
                    JOIN collection_chain chain ON chain.parent_id IS NULL AND chain.inherit_access = TRUE
                ), item_access(user_id, item_id) AS (
                    SELECT m.user_id, i.id FROM members m CROSS JOIN items i
                    JOIN workspace_row w ON w.owner_id = m.user_id
                    UNION
                    SELECT m.user_id, i.id FROM members m CROSS JOIN items i WHERE i.collection_id IS NULL
                    UNION
                    SELECT access.user_id, i.id FROM items i
                    JOIN collection_chain chain ON chain.collection_id = i.collection_id
                    JOIN collection_access access ON access.collection_id = chain.ancestor_id
                    UNION
                    SELECT m.user_id, i.id FROM items i
                    JOIN item_member_grant g ON g.item_id = i.id
                    JOIN members m ON m.id = g.workspace_member_id
                )
                SELECT user_id, 'member' AS resource_key FROM members
                UNION ALL
                SELECT user_id, 'c:' || collection_id::text FROM collection_access
                UNION ALL
                SELECT user_id, 'i:' || item_id::text FROM item_access
                """, resultSet -> {
            Map<UUID, Set<String>> resources = new HashMap<>();
            while (resultSet.next()) {
                UUID userId = resultSet.getObject("user_id", UUID.class);
                resources.computeIfAbsent(userId, ignored -> new HashSet<>()).add(resultSet.getString("resource_key"));
            }
            resources.replaceAll((ignored, values) -> Set.copyOf(values));
            return Map.copyOf(resources);
        }, workspaceId);
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
