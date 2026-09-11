package com.rootly.api.repository;

import com.rootly.api.entity.WorkspaceInvite;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceInviteRepository extends JpaRepository<WorkspaceInvite, UUID> {}
