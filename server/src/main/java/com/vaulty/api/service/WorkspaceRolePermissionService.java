package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.RolePermissionsRequest;
import com.vaulty.api.dto.workspace.RolePermissionsResponse;
import com.vaulty.api.dto.workspace.WorkspacePermission;
import com.vaulty.api.exception.ConflictException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceRolePermissionService {

    private final WorkspaceContentAuthorization authorization;

    @Transactional(readOnly = true)
    public List<WorkspacePermission> catalog(UUID userId, UUID workspaceId) {
        authorization.requireOwner(userId, workspaceId);
        throw fixedRolesConflict();
    }

    @Transactional(readOnly = true)
    public RolePermissionsResponse permissions(UUID userId, UUID workspaceId, UUID roleId) {
        authorization.requireOwner(userId, workspaceId);
        throw fixedRolesConflict();
    }

    @Transactional
    public RolePermissionsResponse replacePermissions(
            UUID userId, UUID workspaceId, UUID roleId, RolePermissionsRequest request) {
        authorization.requireOwnerForUpdate(userId, workspaceId);
        throw fixedRolesConflict();
    }

    private ConflictException fixedRolesConflict() {
        return new ConflictException("As permissões dos papéis do Vaulty são fixas");
    }
}
