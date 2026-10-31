package com.vaulty.api.dto.workspace;

import java.util.List;
import java.util.UUID;

public record RolePermissionsResponse(UUID roleId, String roleName, List<WorkspacePermission> permissions) {}
