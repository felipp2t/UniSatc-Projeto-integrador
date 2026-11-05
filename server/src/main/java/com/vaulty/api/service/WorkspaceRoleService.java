package com.vaulty.api.service;

import com.vaulty.api.dto.role.WorkspaceRoleDefinitionResponse;
import com.vaulty.api.dto.role.RoleRequest;
import com.vaulty.api.dto.role.RoleResponse;
import com.vaulty.api.dto.workspace.WorkspacePermission;
import com.vaulty.api.enums.GlobalRole;
import com.vaulty.api.exception.ConflictException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceRoleService {

    private final WorkspaceContentAuthorization authorization;

    @Transactional(readOnly = true)
    public List<WorkspaceRoleDefinitionResponse> list(UUID userId, UUID workspaceId) {
        authorization.requireOwner(userId, workspaceId);
        return List.of(
                new WorkspaceRoleDefinitionResponse("OWNER", "Owner", "GLOBAL",
                        PermissionCatalog.effectiveOwnerPermissions()),
                new WorkspaceRoleDefinitionResponse("ADMIN", "Admin", "GLOBAL",
                        PermissionCatalog.permissionsForGlobalRole(GlobalRole.ADMIN)),
                new WorkspaceRoleDefinitionResponse("MAINTAINER", "Maintainer", "GLOBAL",
                        PermissionCatalog.permissionsForGlobalRole(GlobalRole.MAINTAINER)),
                new WorkspaceRoleDefinitionResponse("LEADER", "Leader", "COLLECTION",
                        PermissionCatalog.permissionsForTeamRole(true)),
                new WorkspaceRoleDefinitionResponse("MEMBER", "Member", "COLLECTION",
                        PermissionCatalog.permissionsForTeamRole(false)));
    }

    @Transactional
    public RoleResponse create(UUID userId, UUID workspaceId, RoleRequest request) {
        authorization.requireOwner(userId, workspaceId);
        throw fixedRolesConflict();
    }

    @Transactional
    public RoleResponse rename(UUID userId, UUID workspaceId, UUID roleId, RoleRequest request) {
        authorization.requireOwnerForUpdate(userId, workspaceId);
        throw fixedRolesConflict();
    }

    @Transactional(readOnly = true)
    public List<WorkspacePermission> permissions(UUID userId, UUID workspaceId, UUID roleId) {
        authorization.requireOwner(userId, workspaceId);
        throw fixedRolesConflict();
    }

    @Transactional
    public void delete(UUID userId, UUID workspaceId, UUID roleId) {
        authorization.requireOwnerForUpdate(userId, workspaceId);
        throw fixedRolesConflict();
    }

    private ConflictException fixedRolesConflict() {
        return new ConflictException("Os papéis do Vaulty são fixos");
    }
}
