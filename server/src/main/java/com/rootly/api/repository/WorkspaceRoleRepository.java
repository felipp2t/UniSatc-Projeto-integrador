package com.rootly.api.repository;

import com.rootly.api.entity.WorkspaceRole;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceRoleRepository extends JpaRepository<WorkspaceRole, UUID> {

    Optional<WorkspaceRole> findByWorkspaceIdAndName(UUID workspaceId, String name);
}
