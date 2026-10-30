package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceMember;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, UUID> {

    @Query("""
            select member from WorkspaceMember member join fetch member.role
            where member.id = :membershipId and member.user.id = :userId
            """)
    Optional<WorkspaceMember> findByIdAndUserId(
            @Param("membershipId") UUID membershipId, @Param("userId") UUID userId);

    @Query("""
            select member from WorkspaceMember member join fetch member.role
            where member.workspace.id = :workspaceId and member.user.id = :userId
            """)
    Optional<WorkspaceMember> findByWorkspaceIdAndUserId(
            @Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId);

    Optional<WorkspaceMember> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    boolean existsByRoleId(UUID roleId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select member from WorkspaceMember member
            where member.workspace.id = :workspaceId and member.role.name = :ownerRoleName
            order by member.id
            """)
    List<WorkspaceMember> findOwnersForUpdate(
            @Param("workspaceId") UUID workspaceId, @Param("ownerRoleName") String ownerRoleName);

    @Query("""
            select member from WorkspaceMember member
            join fetch member.role
            join fetch member.workspace
            where member.user.id = :userId
            """)
    Optional<WorkspaceMember> findByUserId(@Param("userId") UUID userId);

    @Query("""
            select sibling
            from WorkspaceMember membership
            join membership.workspace workspace
            join WorkspaceMember sibling on sibling.workspace = workspace
            join fetch sibling.user
            join fetch sibling.role
            where membership.user.id = :userId
              and workspace.id = :workspaceId
            order by sibling.createdAt asc
            """)
    List<WorkspaceMember> findAllVisibleToMember(
            @Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId);
}
