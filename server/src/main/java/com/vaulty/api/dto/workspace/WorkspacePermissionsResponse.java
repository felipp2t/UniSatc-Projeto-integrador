package com.vaulty.api.dto.workspace;

import java.util.List;
import java.util.UUID;

public record WorkspacePermissionsResponse(
        boolean isOwner, String globalRole, UUID teamId, boolean isTeamLeader,
        String roleId, String roleName, List<WorkspacePermission> permissions) { }
