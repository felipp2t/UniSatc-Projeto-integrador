package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceItem;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceItemRepository extends JpaRepository<WorkspaceItem, UUID> {

    boolean existsByCollectionIdAndWorkspaceId(UUID collectionId, UUID workspaceId);

    Optional<WorkspaceItem> findByIdAndWorkspaceIdAndArchivedAtIsNull(UUID id, UUID workspaceId);

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
              AND (lower(item.title) LIKE :pattern ESCAPE '!'
                   OR lower(item.title) % :term)
            ORDER BY CASE
                WHEN lower(item.title) = :term THEN 0
                WHEN lower(item.title) LIKE :prefixPattern ESCAPE '!' THEN 1
                WHEN lower(item.title) LIKE :pattern ESCAPE '!' THEN 2
                ELSE 3
            END,
            similarity(lower(item.title), :term) DESC,
            lower(item.title), item.id
            """,
            countQuery = """
            SELECT count(*) FROM item
            WHERE item.workspace_id = :workspaceId AND item.archived_at IS NULL
              AND (:includeSecrets = TRUE OR item.type <> 'secret')
              AND (lower(item.title) LIKE :pattern ESCAPE '!'
                   OR lower(item.title) % :term)
            """, nativeQuery = true)
    Page<WorkspaceItem> searchByTitle(@Param("workspaceId") UUID workspaceId,
                                      @Param("term") String term,
                                      @Param("pattern") String pattern,
                                      @Param("prefixPattern") String prefixPattern,
                                      @Param("includeSecrets") boolean includeSecrets,
                                      Pageable pageable);
}
