package com.vaulty.api.dto.role;

import com.vaulty.api.entity.WorkspaceRole;
import java.util.UUID;

public record RoleResponse(UUID id, String name, boolean builtIn, long memberCount) {

    public RoleResponse(UUID id, String name, long memberCount) {
        this(id, name, WorkspaceRole.isProtectedName(name), memberCount);
    }
}
