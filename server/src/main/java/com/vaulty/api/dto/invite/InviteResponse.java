package com.vaulty.api.dto.invite;

import java.time.OffsetDateTime;
import java.util.UUID;

public record InviteResponse(
        UUID id,
        String email,
        UUID invitedByUserId,
        String invitedByName,
        OffsetDateTime createdAt,
        OffsetDateTime expiresAt) {}
