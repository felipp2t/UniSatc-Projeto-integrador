package com.vaulty.api.dto.workspace;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.UUID;

public record WorkspaceMemberResponse(
        UUID id,
        UUID userId,
        String name,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        String email,
        UUID roleId,
        String roleName) {}
