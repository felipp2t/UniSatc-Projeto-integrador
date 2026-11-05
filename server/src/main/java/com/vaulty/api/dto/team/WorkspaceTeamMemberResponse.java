package com.vaulty.api.dto.team;

import java.util.UUID;

public record WorkspaceTeamMemberResponse(UUID id, UUID userId, String name, String roleName) {}
