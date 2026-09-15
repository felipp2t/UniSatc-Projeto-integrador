package com.rootly.api.repository;

import com.rootly.api.entity.Workspace;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {

    @Query("""
            select workspace
            from WorkspaceMember member
            join member.workspace workspace
            join fetch workspace.owner
            where member.user.id = :userId
            order by workspace.createdAt desc
            """)
    List<Workspace> findAllByMemberUserId(@Param("userId") UUID userId);

    @Query("""
            select workspace
            from WorkspaceMember member
            join member.workspace workspace
            join fetch workspace.owner
            where member.user.id = :userId
              and workspace.id = :workspaceId
            """)
    Optional<Workspace> findByIdAndMemberUserId(
            @Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId);

    @Query("""
            select workspace
            from Workspace workspace
            join fetch workspace.owner
            where workspace.id = :workspaceId
              and workspace.owner.id = :ownerId
            """)
    Optional<Workspace> findByIdAndOwnerId(
            @Param("workspaceId") UUID workspaceId, @Param("ownerId") UUID ownerId);
}
