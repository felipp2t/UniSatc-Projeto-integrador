package com.vaulty.api.repository;

import com.vaulty.api.entity.AccessGroupMember;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccessGroupMemberRepository extends JpaRepository<AccessGroupMember, UUID> {

    @Query("""
            select groupMember from AccessGroupMember groupMember
            join fetch groupMember.workspaceMember member
            join fetch member.user
            where groupMember.group.id = :groupId and groupMember.workspaceId = :workspaceId
            order by member.user.name asc, member.user.id asc
            """)
    List<AccessGroupMember> findAllByGroupIdAndWorkspaceId(
            @Param("groupId") UUID groupId, @Param("workspaceId") UUID workspaceId);

    Optional<AccessGroupMember> findByGroupIdAndWorkspaceIdAndWorkspaceMemberId(
            UUID groupId, UUID workspaceId, UUID workspaceMemberId);

    boolean existsByGroupIdAndWorkspaceId(UUID groupId, UUID workspaceId);
}
