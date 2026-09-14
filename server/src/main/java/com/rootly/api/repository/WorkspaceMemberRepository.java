package com.rootly.api.repository;

import com.rootly.api.entity.WorkspaceMember;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, UUID> {

    boolean existsByWorkspace_IdAndUser_Id(UUID workspaceId, UUID userId);

    @EntityGraph(attributePaths = {"user", "role"})
    List<WorkspaceMember> findAllByWorkspace_IdOrderByCreatedAtAsc(UUID workspaceId);
}
