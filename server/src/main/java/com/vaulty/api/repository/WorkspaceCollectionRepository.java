package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceCollection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceCollectionRepository extends JpaRepository<WorkspaceCollection, UUID> {

    boolean existsByParentIdAndWorkspaceId(UUID parentId, UUID workspaceId);

    Page<WorkspaceCollection> findAllByWorkspaceIdAndParentIsNull(UUID workspaceId, Pageable pageable);

    Page<WorkspaceCollection> findAllByWorkspaceIdAndParentId(UUID workspaceId, UUID parentId, Pageable pageable);

    @Query(value = """
            WITH RECURSIVE team_roots(id) AS (
                SELECT team.root_collection_id
                FROM workspace_member member
                JOIN workspace_team team ON team.id = member.team_id
                WHERE member.workspace_id = :workspaceId AND member.user_id = :userId
            ), team_collections(id) AS (
                SELECT id FROM team_roots
                UNION ALL
                SELECT child.id FROM collection child
                JOIN team_collections parent ON child.parent_id = parent.id
                WHERE child.workspace_id = :workspaceId
            ), global_access(allowed) AS (
                SELECT EXISTS (
                    SELECT 1 FROM workspace WHERE id = :workspaceId AND owner_id = :userId
                    UNION ALL
                    SELECT 1 FROM workspace_member
                    WHERE workspace_id = :workspaceId AND user_id = :userId
                      AND global_role IN ('ADMIN', 'MAINTAINER')
                )
            )
            SELECT c.* FROM collection c CROSS JOIN global_access
            WHERE c.workspace_id=:workspaceId AND ((:parentId IS NULL AND c.parent_id IS NULL) OR c.parent_id=:parentId)
              AND (global_access.allowed OR c.id IN (SELECT id FROM team_collections))
            ORDER BY c.name ASC,c.id ASC
            """, countQuery = """
            WITH RECURSIVE team_roots(id) AS (
                SELECT team.root_collection_id
                FROM workspace_member member
                JOIN workspace_team team ON team.id = member.team_id
                WHERE member.workspace_id = :workspaceId AND member.user_id = :userId
            ), team_collections(id) AS (
                SELECT id FROM team_roots
                UNION ALL
                SELECT child.id FROM collection child
                JOIN team_collections parent ON child.parent_id = parent.id
                WHERE child.workspace_id = :workspaceId
            ), global_access(allowed) AS (
                SELECT EXISTS (
                    SELECT 1 FROM workspace WHERE id = :workspaceId AND owner_id = :userId
                    UNION ALL
                    SELECT 1 FROM workspace_member
                    WHERE workspace_id = :workspaceId AND user_id = :userId
                      AND global_role IN ('ADMIN', 'MAINTAINER')
                )
            )
            SELECT count(*) FROM collection c CROSS JOIN global_access
            WHERE c.workspace_id=:workspaceId AND ((:parentId IS NULL AND c.parent_id IS NULL) OR c.parent_id=:parentId)
              AND (global_access.allowed OR c.id IN (SELECT id FROM team_collections))
            """, nativeQuery = true)
    Page<WorkspaceCollection> findAccessible(@Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId,
                                              @Param("parentId") UUID parentId, Pageable pageable);

    Optional<WorkspaceCollection> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select collection from WorkspaceCollection collection where collection.id = :id and collection.workspace.id = :workspaceId")
    Optional<WorkspaceCollection> findByIdAndWorkspaceIdForUpdate(
            @Param("id") UUID id, @Param("workspaceId") UUID workspaceId);

    @Query(value = """
            WITH RECURSIVE subtree(id, depth) AS (
                SELECT id, 0 FROM collection WHERE id = :collectionId AND workspace_id = :workspaceId
                UNION ALL
                SELECT child.id, parent.depth + 1 FROM collection child
                JOIN subtree parent ON child.parent_id = parent.id
                WHERE child.workspace_id = :workspaceId
            )
            SELECT collection.* FROM collection
            JOIN subtree ON subtree.id = collection.id
            ORDER BY subtree.depth DESC
            """, nativeQuery = true)
    List<WorkspaceCollection> findSubtreeForDelete(
            @Param("workspaceId") UUID workspaceId, @Param("collectionId") UUID collectionId);

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
