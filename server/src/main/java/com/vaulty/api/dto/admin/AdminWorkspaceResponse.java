package com.vaulty.api.dto.admin;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record AdminWorkspaceResponse(
        UUID id,
        String name,
        String description,
        String ownerName,
        String ownerEmail,
        long memberCount,
        List<AdminPendingInviteResponse> pendingInvites,
        OffsetDateTime createdAt) {}
