package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceItem;
import jakarta.persistence.LockModeType;
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
}
