package com.rootly.api.repository;

import com.rootly.api.entity.WorkspaceRole;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceRoleRepository extends JpaRepository<WorkspaceRole, UUID> {}
