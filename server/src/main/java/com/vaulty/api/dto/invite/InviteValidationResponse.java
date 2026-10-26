package com.vaulty.api.dto.invite;

import io.swagger.v3.oas.annotations.media.Schema;

public record InviteValidationResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long remainingSeconds) {}
