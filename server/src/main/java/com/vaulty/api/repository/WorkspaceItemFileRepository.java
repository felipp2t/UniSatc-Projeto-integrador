package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceItemFile;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceItemFileRepository extends JpaRepository<WorkspaceItemFile, UUID> {
}
