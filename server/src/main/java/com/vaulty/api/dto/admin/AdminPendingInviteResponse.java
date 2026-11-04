package com.vaulty.api.dto.admin;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminPendingInviteResponse(
        UUID id,
        String email,
        boolean owner,
        OffsetDateTime expiresAt) {}
