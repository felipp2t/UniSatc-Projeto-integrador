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

    Page<WorkspaceCollection> findAllByWorkspaceIdAndParentIsNull(UUID workspaceId, Pageable pageable);

    Page<WorkspaceCollection> findAllByWorkspaceIdAndParentId(UUID workspaceId, UUID parentId, Pageable pageable);

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
