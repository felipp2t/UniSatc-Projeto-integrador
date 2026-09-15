package com.rootly.api.repository;

import com.rootly.api.entity.WorkspaceMember;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, UUID> {

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
