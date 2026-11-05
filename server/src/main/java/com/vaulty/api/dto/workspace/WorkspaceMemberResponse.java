package com.vaulty.api.dto.workspace;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.vaulty.api.enums.GlobalRole;
import java.util.UUID;

public record WorkspaceMemberResponse(
        UUID id,
        UUID userId,
        String name,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        String email,
        GlobalRole globalRole,
        UUID teamId,
        boolean isTeamLeader,
        String roleName) {}
