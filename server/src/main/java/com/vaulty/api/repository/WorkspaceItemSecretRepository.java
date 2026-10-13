package com.vaulty.api.repository;

import com.vaulty.api.entity.WorkspaceItemSecret;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceItemSecretRepository extends JpaRepository<WorkspaceItemSecret, UUID> {
}
