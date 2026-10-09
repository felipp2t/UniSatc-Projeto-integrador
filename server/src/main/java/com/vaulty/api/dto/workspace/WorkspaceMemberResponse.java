package com.vaulty.api.dto.workspace;

import java.util.UUID;

public record WorkspaceMemberResponse(
        UUID id,
        UUID userId,
        String name,
        String email,
        UUID roleId,
        String roleName) {}
