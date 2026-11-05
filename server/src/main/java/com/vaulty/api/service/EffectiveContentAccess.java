package com.vaulty.api.service;

import com.vaulty.api.entity.Workspace;
import com.vaulty.api.exception.ResourceNotFoundException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

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
                    SELECT member.id, member.user_id, member.team_id, member.global_role,
                           workspace.owner_id
                    FROM workspace_member member
                    JOIN workspace_row workspace ON workspace.id = member.workspace_id
                ), collections AS (
                    SELECT collection.id, collection.parent_id
                    FROM collection JOIN workspace_row ON workspace_row.id = collection.workspace_id
                ), items AS (
                    SELECT item.id, item.collection_id
                    FROM item JOIN workspace_row ON workspace_row.id = item.workspace_id
                ), collection_chain(collection_id, ancestor_id, parent_id) AS (
                    SELECT id, id, parent_id FROM collections
                    UNION ALL
                    SELECT chain.collection_id, parent.id, parent.parent_id
                    FROM collection_chain chain JOIN collections parent ON parent.id = chain.parent_id
                ), collection_access(user_id, collection_id) AS (
                    SELECT member.user_id, collection.id
                    FROM members member CROSS JOIN collections collection
                    WHERE member.user_id = member.owner_id
                       OR member.global_role IN ('ADMIN', 'MAINTAINER')
                    UNION
                    SELECT member.user_id, chain.collection_id
                    FROM members member
                    JOIN workspace_team team ON team.id = member.team_id
                    JOIN collection_chain chain ON chain.ancestor_id = team.root_collection_id
                ), item_access(user_id, item_id) AS (
                    SELECT member.user_id, item.id
                    FROM members member CROSS JOIN items item
                    WHERE member.user_id = member.owner_id
                       OR member.global_role IN ('ADMIN', 'MAINTAINER')
                    UNION
                    SELECT access.user_id, item.id
                    FROM items item JOIN collection_access access ON access.collection_id = item.collection_id
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
        if (collectionId == null) {
            return hasGlobalRead(userId, workspace.getId());
        }
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                WITH RECURSIVE chain(id, parent_id) AS (
                    SELECT id, parent_id FROM collection WHERE id = ? AND workspace_id = ?
                    UNION ALL
                    SELECT parent.id, parent.parent_id
                    FROM collection parent JOIN chain child ON child.parent_id = parent.id
                    WHERE parent.workspace_id = ?
                )
                SELECT EXISTS (
                    SELECT 1 FROM workspace_member member
                    JOIN workspace ON workspace.id = member.workspace_id
                    WHERE member.workspace_id = ? AND member.user_id = ?
                      AND EXISTS (SELECT 1 FROM chain)
                      AND (workspace.owner_id = member.user_id
                           OR member.global_role IN ('ADMIN', 'MAINTAINER')
                           OR EXISTS (
                               SELECT 1 FROM workspace_team team JOIN chain ON chain.id = team.root_collection_id
                               WHERE team.id = member.team_id AND team.workspace_id = member.workspace_id
                           ))
                )
                """, Boolean.class, collectionId, workspace.getId(), workspace.getId(),
                workspace.getId(), userId));
    }

    public boolean canReadItem(UUID userId, Workspace workspace, UUID itemId) {
        return canReadItem(userId, workspace, itemId, true);
    }

    public boolean canReadItem(UUID userId, Workspace workspace, UUID itemId, boolean canReadSecrets) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                WITH RECURSIVE item_row AS (
                    SELECT id, collection_id, type FROM item WHERE id = ? AND workspace_id = ?
                ), chain(id, parent_id) AS (
                    SELECT collection.id, collection.parent_id
                    FROM collection JOIN item_row ON item_row.collection_id = collection.id
                    UNION ALL
                    SELECT parent.id, parent.parent_id
                    FROM collection parent JOIN chain child ON child.parent_id = parent.id
                    WHERE parent.workspace_id = ?
                )
                SELECT EXISTS (
                    SELECT 1 FROM item_row item
                    JOIN workspace_member member ON member.workspace_id = ? AND member.user_id = ?
                    JOIN workspace ON workspace.id = member.workspace_id
                    WHERE (item.type <> 'secret' OR ?)
                      AND (workspace.owner_id = member.user_id
                           OR member.global_role IN ('ADMIN', 'MAINTAINER')
                           OR EXISTS (
                               SELECT 1 FROM workspace_team team JOIN chain ON chain.id = team.root_collection_id
                               WHERE team.id = member.team_id AND team.workspace_id = member.workspace_id
                           ))
                )
                """, Boolean.class, itemId, workspace.getId(), workspace.getId(),
                workspace.getId(), userId, canReadSecrets));
    }

    public void requireCollection(UUID userId, Workspace workspace, UUID collectionId) {
        if (!canReadCollection(userId, workspace, collectionId)) {
            throw new ResourceNotFoundException("Pasta não encontrada");
        }
    }

    public void requireCollectionWrite(UUID userId, Workspace workspace, UUID collectionId) {
        if (!canWriteCollection(userId, workspace, collectionId)) {
            throw new ResourceNotFoundException("Pasta não encontrada");
        }
    }

    public boolean canWriteCollection(UUID userId, Workspace workspace, UUID collectionId) {
        if (collectionId == null) {
            return hasGlobalWrite(userId, workspace.getId());
        }
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                WITH RECURSIVE chain(id, parent_id) AS (
                    SELECT id, parent_id FROM collection WHERE id = ? AND workspace_id = ?
                    UNION ALL
                    SELECT parent.id, parent.parent_id
                    FROM collection parent JOIN chain child ON child.parent_id = parent.id
                    WHERE parent.workspace_id = ?
                )
                SELECT EXISTS (
                    SELECT 1 FROM workspace_member member
                    JOIN workspace ON workspace.id = member.workspace_id
                    WHERE member.workspace_id = ? AND member.user_id = ?
                      AND EXISTS (SELECT 1 FROM chain)
                      AND (workspace.owner_id = member.user_id OR member.global_role = 'ADMIN'
                           OR EXISTS (
                               SELECT 1 FROM workspace_team team JOIN chain ON chain.id = team.root_collection_id
                               WHERE team.id = member.team_id AND team.workspace_id = member.workspace_id
                           ))
                )
                """, Boolean.class, collectionId, workspace.getId(), workspace.getId(), workspace.getId(), userId));
    }

    public void requireItem(UUID userId, Workspace workspace, UUID itemId) {
        if (!canReadItem(userId, workspace, itemId)) {
            throw new ResourceNotFoundException("Item indisponível");
        }
    }

    public List<String> origins(UUID userId, UUID workspaceId, UUID itemId) {
        return List.of();
    }

    public List<String> collectionOrigins(UUID userId, UUID workspaceId, UUID collectionId) {
        return List.of();
    }

    private boolean hasGlobalRead(UUID userId, UUID workspaceId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM workspace_member member
                    JOIN workspace ON workspace.id = member.workspace_id
                    WHERE member.workspace_id = ? AND member.user_id = ?
                      AND (workspace.owner_id = member.user_id
                           OR member.global_role IN ('ADMIN', 'MAINTAINER'))
                )
                """, Boolean.class, workspaceId, userId));
    }

    private boolean hasGlobalWrite(UUID userId, UUID workspaceId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM workspace_member member
                    JOIN workspace ON workspace.id = member.workspace_id
                    WHERE member.workspace_id = ? AND member.user_id = ?
                      AND (workspace.owner_id = member.user_id OR member.global_role = 'ADMIN')
                )
                """, Boolean.class, workspaceId, userId));
    }
}
