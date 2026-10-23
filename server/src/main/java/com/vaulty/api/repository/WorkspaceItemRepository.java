package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceItem;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;

public interface WorkspaceItemRepository extends JpaRepository<WorkspaceItem, UUID> {

    boolean existsByCollectionIdAndWorkspaceId(UUID collectionId, UUID workspaceId);

    Optional<WorkspaceItem> findByIdAndWorkspaceIdAndArchivedAtIsNull(UUID id, UUID workspaceId);

    Optional<WorkspaceItem> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select item from WorkspaceItem item where item.id = :id and item.workspace.id = :workspaceId")
    Optional<WorkspaceItem> lockByIdAndWorkspaceId(@Param("id") UUID id, @Param("workspaceId") UUID workspaceId);

    @Query("""
            select item from WorkspaceItem item
            where item.workspace.id = :workspaceId and (:includeArchived = true or item.archivedAt is null)
              and ((:collectionId is null and item.collection is null) or item.collection.id = :collectionId)
              and (:includeSecrets = true or item.type <> 'secret')
            """)
    Page<WorkspaceItem> list(@Param("workspaceId") UUID workspaceId,
                             @Param("collectionId") UUID collectionId,
                             @Param("includeSecrets") boolean includeSecrets,
                             @Param("includeArchived") boolean includeArchived,
                             Pageable pageable);

    @Query(value = """
            SELECT item.* FROM item
            WHERE item.workspace_id = :workspaceId AND (:includeArchived = TRUE OR item.archived_at IS NULL)
              AND (:includeSecrets = TRUE OR item.type <> 'secret')
              AND item.title_search @@ plainto_tsquery('simple', normalize_content_name(:term))
            ORDER BY item.title_key, item.id
            """,
            countQuery = """
            SELECT count(*) FROM item
            WHERE item.workspace_id = :workspaceId AND (:includeArchived = TRUE OR item.archived_at IS NULL)
              AND (:includeSecrets = TRUE OR item.type <> 'secret')
              AND item.title_search @@ plainto_tsquery('simple', normalize_content_name(:term))
            """, nativeQuery = true)
    Page<WorkspaceItem> searchByTitle(@Param("workspaceId") UUID workspaceId,
                                      @Param("term") String term,
                                      @Param("includeSecrets") boolean includeSecrets,
                                      @Param("includeArchived") boolean includeArchived,
                                      Pageable pageable);
}
