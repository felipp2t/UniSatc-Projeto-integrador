package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceItem;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceItemRepository extends JpaRepository<WorkspaceItem, UUID> {

    boolean existsByCollectionIdAndWorkspaceId(UUID collectionId, UUID workspaceId);

    List<WorkspaceItem> findAllByWorkspaceIdAndCollectionIdIn(UUID workspaceId, Collection<UUID> collectionIds);

    Optional<WorkspaceItem> findByIdAndWorkspaceIdAndArchivedAtIsNull(UUID id, UUID workspaceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select item from WorkspaceItem item
            where item.id = :itemId and item.workspace.id = :workspaceId and item.archivedAt is null
            """)
    Optional<WorkspaceItem> findActiveForUpdate(@Param("itemId") UUID itemId,
                                                @Param("workspaceId") UUID workspaceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select item from WorkspaceItem item
            where item.id = :itemId and item.workspace.id = :workspaceId
            """)
    Optional<WorkspaceItem> findAnyForUpdate(@Param("itemId") UUID itemId,
                                             @Param("workspaceId") UUID workspaceId);

    @Query("""
            select item from WorkspaceItem item
            where item.id = :itemId and item.workspace.id = :workspaceId
            """)
    Optional<WorkspaceItem> findIncludingArchived(@Param("itemId") UUID itemId,
                                                  @Param("workspaceId") UUID workspaceId);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("""
            select item from WorkspaceItem item
            where item.id = :itemId and item.workspace.id = :workspaceId
            """)
    Optional<WorkspaceItem> findForRead(@Param("itemId") UUID itemId,
                                        @Param("workspaceId") UUID workspaceId);

    @Query("""
            select item from WorkspaceItem item
            where item.workspace.id = :workspaceId and item.archivedAt is null
              and ((:collectionId is null and item.collection is null) or item.collection.id = :collectionId)
              and (:includeSecrets = true or item.type <> 'secret')
            """)
    Page<WorkspaceItem> list(@Param("workspaceId") UUID workspaceId,
                             @Param("collectionId") UUID collectionId,
                             @Param("includeSecrets") boolean includeSecrets,
                             Pageable pageable);

    @Query(value = """
            WITH RECURSIVE team_roots(id) AS (
                SELECT team.root_collection_id FROM workspace_member member
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
            SELECT item.* FROM item CROSS JOIN global_access
            WHERE item.workspace_id=:workspaceId AND (item.archived_at IS NOT NULL) = :archived
              AND ((:collectionId IS NULL AND item.collection_id IS NULL) OR item.collection_id=:collectionId)
              AND (:includeSecrets=TRUE OR item.type<>'secret')
              AND (global_access.allowed OR item.collection_id IN (SELECT id FROM team_collections))
            ORDER BY item.title ASC, item.id ASC
            """, countQuery = """
            WITH RECURSIVE team_roots(id) AS (
                SELECT team.root_collection_id FROM workspace_member member
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
            SELECT count(*) FROM item CROSS JOIN global_access
            WHERE item.workspace_id=:workspaceId AND (item.archived_at IS NOT NULL) = :archived
              AND ((:collectionId IS NULL AND item.collection_id IS NULL) OR item.collection_id=:collectionId)
              AND (:includeSecrets=TRUE OR item.type<>'secret')
              AND (global_access.allowed OR item.collection_id IN (SELECT id FROM team_collections))
            """, nativeQuery = true)
    Page<WorkspaceItem> listAccessible(@Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId,
                                       @Param("collectionId") UUID collectionId,
                                       @Param("includeSecrets") boolean includeSecrets,
                                       @Param("archived") boolean archived, Pageable pageable);

    @Query(value = """
            SELECT item.* FROM item
            WHERE item.workspace_id = :workspaceId AND item.archived_at IS NULL
              AND (:includeSecrets = TRUE OR item.type <> 'secret')
              AND item.title_search @@ plainto_tsquery('simple', normalize_content_name(:term))
            ORDER BY item.title_key, item.id
            """,
            countQuery = """
            SELECT count(*) FROM item
            WHERE item.workspace_id = :workspaceId AND item.archived_at IS NULL
              AND (:includeSecrets = TRUE OR item.type <> 'secret')
              AND item.title_search @@ plainto_tsquery('simple', normalize_content_name(:term))
            """, nativeQuery = true)
    Page<WorkspaceItem> searchByTitle(@Param("workspaceId") UUID workspaceId,
                                      @Param("term") String term,
                                      @Param("includeSecrets") boolean includeSecrets,
                                      Pageable pageable);

    @Query(value = """
            WITH RECURSIVE team_roots(id) AS (
                SELECT team.root_collection_id FROM workspace_member member
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
            SELECT item.* FROM item CROSS JOIN global_access
            WHERE item.workspace_id=:workspaceId AND (:includeArchived=TRUE OR item.archived_at IS NULL)
              AND (:includeSecrets=TRUE OR item.type<>'secret')
              AND item.title_search @@ plainto_tsquery('simple', normalize_content_name(:term))
              AND (global_access.allowed OR item.collection_id IN (SELECT id FROM team_collections))
            ORDER BY item.title_key,item.id
            """, countQuery = """
            WITH RECURSIVE team_roots(id) AS (
                SELECT team.root_collection_id FROM workspace_member member
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
            SELECT count(*) FROM item CROSS JOIN global_access
            WHERE item.workspace_id=:workspaceId AND (:includeArchived=TRUE OR item.archived_at IS NULL) AND (:includeSecrets=TRUE OR item.type<>'secret')
              AND item.title_search @@ plainto_tsquery('simple', normalize_content_name(:term))
              AND (global_access.allowed OR item.collection_id IN (SELECT id FROM team_collections))
            """, nativeQuery = true)
    Page<WorkspaceItem> searchAccessible(@Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId,
                                         @Param("term") String term, @Param("includeSecrets") boolean includeSecrets,
                                         @Param("includeArchived") boolean includeArchived,
                                         Pageable pageable);
}
