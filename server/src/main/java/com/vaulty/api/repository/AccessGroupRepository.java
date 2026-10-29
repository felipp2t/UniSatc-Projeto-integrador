package com.vaulty.api.repository;

import com.vaulty.api.entity.AccessGroup;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccessGroupRepository extends JpaRepository<AccessGroup, UUID> {

    List<AccessGroup> findAllByWorkspaceIdOrderByNameAscIdAsc(UUID workspaceId);

    Optional<AccessGroup> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select accessGroup from AccessGroup accessGroup
            where accessGroup.id = :groupId and accessGroup.workspace.id = :workspaceId
            """)
    Optional<AccessGroup> findByIdAndWorkspaceIdForUpdate(
            @Param("groupId") UUID groupId, @Param("workspaceId") UUID workspaceId);

    boolean existsByIdAndWorkspaceId(UUID id, UUID workspaceId);
}
