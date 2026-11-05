package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceTeam;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceTeamRepository extends JpaRepository<WorkspaceTeam, UUID> {

    List<WorkspaceTeam> findAllByWorkspaceIdOrderByNameAscIdAsc(UUID workspaceId);

    Optional<WorkspaceTeam> findByIdAndWorkspaceId(UUID teamId, UUID workspaceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select team from WorkspaceTeam team where team.id = :teamId and team.workspace.id = :workspaceId")
    Optional<WorkspaceTeam> findByIdAndWorkspaceIdForUpdate(
            @Param("teamId") UUID teamId, @Param("workspaceId") UUID workspaceId);

    boolean existsByWorkspaceIdAndRootCollectionId(UUID workspaceId, UUID rootCollectionId);

    long countByWorkspaceIdAndRootCollectionId(UUID workspaceId, UUID rootCollectionId);

    @Query("select team from WorkspaceTeam team join fetch team.rootCollection join fetch team.leader leader join fetch leader.user where team.workspace.id = :workspaceId and team.id = :teamId")
    Optional<WorkspaceTeam> findWithDetails(@Param("workspaceId") UUID workspaceId, @Param("teamId") UUID teamId);

    boolean existsByIdAndLeader_Id(UUID teamId, UUID leaderId);
}
