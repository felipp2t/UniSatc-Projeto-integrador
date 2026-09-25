package com.vaulty.api.dto.workspace;

import java.time.OffsetDateTime;
import java.util.UUID;

public record WorkspaceResponse(
        UUID id,
        UUID ownerId,
        String name,
        String description,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {}
