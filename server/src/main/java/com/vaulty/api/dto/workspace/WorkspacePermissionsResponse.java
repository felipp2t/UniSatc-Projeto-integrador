package com.vaulty.api.dto.workspace;

import java.util.List;

public record WorkspacePermissionsResponse(
        boolean isOwner, String roleId, String roleName, List<WorkspacePermission> permissions) { }
