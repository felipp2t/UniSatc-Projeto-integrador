package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceCollection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceCollectionRepository extends JpaRepository<WorkspaceCollection, UUID> {

    boolean existsByParentIdAndWorkspaceId(UUID parentId, UUID workspaceId);

    Page<WorkspaceCollection> findAllByWorkspaceIdAndParentIsNull(UUID workspaceId, Pageable pageable);

    Page<WorkspaceCollection> findAllByWorkspaceIdAndParentId(UUID workspaceId, UUID parentId, Pageable pageable);

    @Query(value = """
            WITH RECURSIVE granted_collections(id) AS (
                SELECT c.id FROM collection c WHERE c.workspace_id=:workspaceId AND c.parent_id IS NULL AND c.inherit_access=TRUE
                UNION SELECT g.collection_id FROM collection_public_grant g JOIN collection c ON c.id=g.collection_id WHERE c.workspace_id=:workspaceId
                UNION SELECT g.collection_id FROM collection_access_grant g JOIN access_group_member gm ON gm.group_id=g.group_id JOIN workspace_member wm ON wm.id=gm.workspace_member_id JOIN collection c ON c.id=g.collection_id WHERE wm.user_id=:userId AND wm.workspace_id=:workspaceId
                UNION SELECT child.id FROM collection child JOIN granted_collections parent ON child.parent_id=parent.id WHERE child.workspace_id=:workspaceId AND child.inherit_access=TRUE
            ) SELECT c.* FROM collection c JOIN workspace w ON w.id=c.workspace_id
            WHERE c.workspace_id=:workspaceId AND ((:parentId IS NULL AND c.parent_id IS NULL) OR c.parent_id=:parentId)
              AND (w.owner_id=:userId OR c.id IN (SELECT id FROM granted_collections))
            ORDER BY c.name ASC,c.id ASC
            """, countQuery = """
            WITH RECURSIVE granted_collections(id) AS (
                SELECT c.id FROM collection c WHERE c.workspace_id=:workspaceId AND c.parent_id IS NULL AND c.inherit_access=TRUE
                UNION SELECT g.collection_id FROM collection_public_grant g JOIN collection c ON c.id=g.collection_id WHERE c.workspace_id=:workspaceId
                UNION SELECT g.collection_id FROM collection_access_grant g JOIN access_group_member gm ON gm.group_id=g.group_id JOIN workspace_member wm ON wm.id=gm.workspace_member_id JOIN collection c ON c.id=g.collection_id WHERE wm.user_id=:userId AND wm.workspace_id=:workspaceId
                UNION SELECT child.id FROM collection child JOIN granted_collections parent ON child.parent_id=parent.id WHERE child.workspace_id=:workspaceId AND child.inherit_access=TRUE
            ) SELECT count(*) FROM collection c JOIN workspace w ON w.id=c.workspace_id
            WHERE c.workspace_id=:workspaceId AND ((:parentId IS NULL AND c.parent_id IS NULL) OR c.parent_id=:parentId)
              AND (w.owner_id=:userId OR c.id IN (SELECT id FROM granted_collections))
            """, nativeQuery = true)
    Page<WorkspaceCollection> findAccessible(@Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId,
                                              @Param("parentId") UUID parentId, Pageable pageable);

    Optional<WorkspaceCollection> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    @Query(value = """
            WITH RECURSIVE collection_path AS (
                SELECT id, name, parent_id, 0 AS depth
                FROM collection
                WHERE id = :collectionId AND workspace_id = :workspaceId
                UNION ALL
                SELECT parent.id, parent.name, parent.parent_id, child.depth + 1
                FROM collection parent
                JOIN collection_path child ON child.parent_id = parent.id
                WHERE parent.workspace_id = :workspaceId
            )
            SELECT id AS \"id\", name AS \"name\"
            FROM collection_path
            ORDER BY depth DESC
            """, nativeQuery = true)
    List<CollectionPathProjection> findPath(
            @Param("workspaceId") UUID workspaceId, @Param("collectionId") UUID collectionId);
}
