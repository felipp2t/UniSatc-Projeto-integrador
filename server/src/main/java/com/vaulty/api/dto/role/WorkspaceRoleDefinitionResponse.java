package com.vaulty.api.dto.role;

import com.vaulty.api.dto.workspace.WorkspacePermission;
import java.util.List;

public record WorkspaceRoleDefinitionResponse(
        String code, String name, String scope, List<WorkspacePermission> permissions) {}
