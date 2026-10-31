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
            WITH RECURSIVE granted_collections(id) AS (
                SELECT c.id FROM collection c WHERE c.workspace_id = :workspaceId AND c.parent_id IS NULL AND c.inherit_access=TRUE
                UNION SELECT g.collection_id FROM collection_public_grant g JOIN collection c ON c.id=g.collection_id
                    WHERE c.workspace_id=:workspaceId
                UNION SELECT g.collection_id FROM collection_access_grant g JOIN access_group_member gm ON gm.group_id=g.group_id
                    JOIN workspace_member wm ON wm.id=gm.workspace_member_id JOIN collection c ON c.id=g.collection_id
                    WHERE wm.user_id=:userId AND wm.workspace_id=:workspaceId
                UNION SELECT child.id FROM collection child JOIN granted_collections parent ON child.parent_id=parent.id
                    WHERE child.workspace_id=:workspaceId AND child.inherit_access=TRUE
            )
            SELECT item.* FROM item JOIN workspace w ON w.id=item.workspace_id
            WHERE item.workspace_id=:workspaceId AND item.archived_at IS NULL
              AND ((:collectionId IS NULL AND item.collection_id IS NULL) OR item.collection_id=:collectionId)
              AND (:includeSecrets=TRUE OR item.type<>'secret')
              AND (w.owner_id=:userId OR item.collection_id IS NULL OR item.collection_id IN (SELECT id FROM granted_collections)
                   OR EXISTS (SELECT 1 FROM item_member_grant g JOIN workspace_member wm ON wm.id=g.workspace_member_id
                              WHERE g.item_id=item.id AND wm.user_id=:userId AND wm.workspace_id=:workspaceId))
            ORDER BY item.title ASC, item.id ASC
            """, countQuery = """
            WITH RECURSIVE granted_collections(id) AS (
                SELECT c.id FROM collection c WHERE c.workspace_id = :workspaceId AND c.parent_id IS NULL AND c.inherit_access=TRUE
                UNION SELECT g.collection_id FROM collection_public_grant g JOIN collection c ON c.id=g.collection_id WHERE c.workspace_id=:workspaceId
                UNION SELECT g.collection_id FROM collection_access_grant g JOIN access_group_member gm ON gm.group_id=g.group_id JOIN workspace_member wm ON wm.id=gm.workspace_member_id JOIN collection c ON c.id=g.collection_id WHERE wm.user_id=:userId AND wm.workspace_id=:workspaceId
                UNION SELECT child.id FROM collection child JOIN granted_collections parent ON child.parent_id=parent.id WHERE child.workspace_id=:workspaceId AND child.inherit_access=TRUE
            ) SELECT count(*) FROM item JOIN workspace w ON w.id=item.workspace_id
            WHERE item.workspace_id=:workspaceId AND item.archived_at IS NULL
              AND ((:collectionId IS NULL AND item.collection_id IS NULL) OR item.collection_id=:collectionId)
              AND (:includeSecrets=TRUE OR item.type<>'secret')
              AND (w.owner_id=:userId OR item.collection_id IS NULL OR item.collection_id IN (SELECT id FROM granted_collections)
                   OR EXISTS (SELECT 1 FROM item_member_grant g JOIN workspace_member wm ON wm.id=g.workspace_member_id WHERE g.item_id=item.id AND wm.user_id=:userId AND wm.workspace_id=:workspaceId))
            """, nativeQuery = true)
    Page<WorkspaceItem> listAccessible(@Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId,
                                       @Param("collectionId") UUID collectionId,
                                       @Param("includeSecrets") boolean includeSecrets, Pageable pageable);

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
            WITH RECURSIVE granted_collections(id) AS (
                SELECT c.id FROM collection c WHERE c.workspace_id=:workspaceId AND c.parent_id IS NULL AND c.inherit_access=TRUE
                UNION SELECT g.collection_id FROM collection_public_grant g JOIN collection c ON c.id=g.collection_id WHERE c.workspace_id=:workspaceId
                UNION SELECT g.collection_id FROM collection_access_grant g JOIN access_group_member gm ON gm.group_id=g.group_id JOIN workspace_member wm ON wm.id=gm.workspace_member_id JOIN collection c ON c.id=g.collection_id WHERE wm.user_id=:userId AND wm.workspace_id=:workspaceId
                UNION SELECT child.id FROM collection child JOIN granted_collections parent ON child.parent_id=parent.id WHERE child.workspace_id=:workspaceId AND child.inherit_access=TRUE
            ) SELECT item.* FROM item JOIN workspace w ON w.id=item.workspace_id
            WHERE item.workspace_id=:workspaceId AND item.archived_at IS NULL
              AND (:includeSecrets=TRUE OR item.type<>'secret')
              AND item.title_search @@ plainto_tsquery('simple', normalize_content_name(:term))
              AND (w.owner_id=:userId OR item.collection_id IS NULL OR item.collection_id IN (SELECT id FROM granted_collections)
                   OR EXISTS (SELECT 1 FROM item_member_grant g JOIN workspace_member wm ON wm.id=g.workspace_member_id WHERE g.item_id=item.id AND wm.user_id=:userId AND wm.workspace_id=:workspaceId))
            ORDER BY item.title_key,item.id
            """, countQuery = """
            WITH RECURSIVE granted_collections(id) AS (
                SELECT c.id FROM collection c WHERE c.workspace_id=:workspaceId AND c.parent_id IS NULL AND c.inherit_access=TRUE
                UNION SELECT g.collection_id FROM collection_public_grant g JOIN collection c ON c.id=g.collection_id WHERE c.workspace_id=:workspaceId
                UNION SELECT g.collection_id FROM collection_access_grant g JOIN access_group_member gm ON gm.group_id=g.group_id JOIN workspace_member wm ON wm.id=gm.workspace_member_id JOIN collection c ON c.id=g.collection_id WHERE wm.user_id=:userId AND wm.workspace_id=:workspaceId
                UNION SELECT child.id FROM collection child JOIN granted_collections parent ON child.parent_id=parent.id WHERE child.workspace_id=:workspaceId AND child.inherit_access=TRUE
            ) SELECT count(*) FROM item JOIN workspace w ON w.id=item.workspace_id
            WHERE item.workspace_id=:workspaceId AND item.archived_at IS NULL AND (:includeSecrets=TRUE OR item.type<>'secret')
              AND item.title_search @@ plainto_tsquery('simple', normalize_content_name(:term))
              AND (w.owner_id=:userId OR item.collection_id IS NULL OR item.collection_id IN (SELECT id FROM granted_collections)
                   OR EXISTS (SELECT 1 FROM item_member_grant g JOIN workspace_member wm ON wm.id=g.workspace_member_id WHERE g.item_id=item.id AND wm.user_id=:userId AND wm.workspace_id=:workspaceId))
            """, nativeQuery = true)
    Page<WorkspaceItem> searchAccessible(@Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId,
                                         @Param("term") String term, @Param("includeSecrets") boolean includeSecrets,
                                         Pageable pageable);
}
