package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceMember;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, UUID> {

    @Query("""
            select member from WorkspaceMember member
            left join fetch member.role
            left join fetch member.team
            where member.id = :membershipId and member.user.id = :userId
            """)
    Optional<WorkspaceMember> findByIdAndUserId(
            @Param("membershipId") UUID membershipId, @Param("userId") UUID userId);

    @Query("""
            select member from WorkspaceMember member
            left join fetch member.role
            left join fetch member.team
            join fetch member.workspace workspace
            join fetch workspace.owner
            where member.workspace.id = :workspaceId and member.user.id = :userId
            """)
    Optional<WorkspaceMember> findByWorkspaceIdAndUserId(
            @Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId);

    Optional<WorkspaceMember> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    @Query("select member from WorkspaceMember member join fetch member.user left join fetch member.role where member.id = :id and member.workspace.id = :workspaceId")
    Optional<WorkspaceMember> findWithUserByIdAndWorkspaceId(
            @Param("id") UUID id, @Param("workspaceId") UUID workspaceId);

    @Query("select member from WorkspaceMember member join fetch member.user left join fetch member.role left join fetch member.team where member.id = :id and member.workspace.id = :workspaceId")
    Optional<WorkspaceMember> findWithTeamByIdAndWorkspaceId(
            @Param("id") UUID id, @Param("workspaceId") UUID workspaceId);

    @Query("select member from WorkspaceMember member join fetch member.user left join fetch member.role where member.team.id = :teamId order by member.createdAt, member.id")
    List<WorkspaceMember> findAllByTeamId(@Param("teamId") UUID teamId);

    boolean existsByRoleId(UUID roleId);

    @Query("""
            select count(member) from WorkspaceMember member
            where member.workspace.id = :workspaceId and member.role.id = :roleId
            """)
    long countByWorkspaceIdAndRoleId(
            @Param("workspaceId") UUID workspaceId, @Param("roleId") UUID roleId);

    @Query("select member from WorkspaceMember member join fetch member.user where member.workspace.id = :workspaceId and member.role.id = :roleId")
    List<WorkspaceMember> findAllByWorkspaceIdAndRoleId(
            @Param("workspaceId") UUID workspaceId, @Param("roleId") UUID roleId);

    @Query("""
            select member from WorkspaceMember member
            where member.workspace.id = :workspaceId and member.role.name = :ownerRoleName
            order by member.id
            """)
    List<WorkspaceMember> findOwners(
            @Param("workspaceId") UUID workspaceId, @Param("ownerRoleName") String ownerRoleName);

    @Query("""
            select member from WorkspaceMember member
            left join fetch member.role
            left join fetch member.team
            join fetch member.workspace workspace
            join fetch workspace.owner
            where member.user.id = :userId
            """)
    Optional<WorkspaceMember> findByUserId(@Param("userId") UUID userId);

    @Query("""
            select sibling
            from WorkspaceMember membership
            join membership.workspace workspace
            join WorkspaceMember sibling on sibling.workspace = workspace
            join fetch sibling.user
            left join fetch sibling.role
            left join fetch sibling.team team
            left join fetch team.leader
            where membership.user.id = :userId
              and workspace.id = :workspaceId
            order by sibling.createdAt asc
            """)
    List<WorkspaceMember> findAllVisibleToMember(
            @Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId);
}
