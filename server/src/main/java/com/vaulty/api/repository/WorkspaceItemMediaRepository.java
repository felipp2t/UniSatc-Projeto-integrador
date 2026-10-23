package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceItemMedia;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceItemMediaRepository extends JpaRepository<WorkspaceItemMedia, UUID> {
}
