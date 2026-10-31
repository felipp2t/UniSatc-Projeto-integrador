package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.RolePermissionsRequest;
import com.vaulty.api.dto.workspace.RolePermissionsResponse;
import com.vaulty.api.dto.workspace.WorkspacePermission;
import com.vaulty.api.entity.RolePermission;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.repository.RolePermissionRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceRolePermissionService {

    private final WorkspaceService workspaceService;
    private final WorkspaceRoleRepository roleRepository;
    private final RolePermissionRepository permissionRepository;
    private final ActivityLogService activityLogService;

    public WorkspaceRolePermissionService(
            WorkspaceService workspaceService,
            WorkspaceRoleRepository roleRepository,
            RolePermissionRepository permissionRepository,
            ActivityLogService activityLogService) {
        this.workspaceService = workspaceService;
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.activityLogService = activityLogService;
    }

    @Transactional(readOnly = true)
    public List<WorkspacePermission> catalog(UUID userId, UUID workspaceId) {
        requireOwner(userId, workspaceId);
        return PermissionCatalog.permissions();
    }

    @Transactional(readOnly = true)
    public RolePermissionsResponse permissions(UUID userId, UUID workspaceId, UUID roleId) {
        requireOwner(userId, workspaceId);
        WorkspaceRole role = findRole(roleId, workspaceId);
        return response(role, permissionRepository.findAllByRoleId(roleId));
    }

    @Transactional
    public RolePermissionsResponse replacePermissions(
            UUID userId, UUID workspaceId, UUID roleId, RolePermissionsRequest request) {
        requireOwner(userId, workspaceId);
        WorkspaceRole role = findRoleForUpdate(roleId, workspaceId);
        if (role.isProtected()) {
            throw new ValidationException("As permissões do papel inicial não podem ser alteradas");
        }

        List<WorkspacePermission> requested = request.permissions().stream()
                .map(permission -> new WorkspacePermission(permission.resource(), permission.action()))
                .toList();
        if (new HashSet<>(requested).size() != requested.size()) {
            throw new ValidationException("A lista de permissões não pode conter duplicatas");
        }
        if (requested.stream().anyMatch(permission -> !PermissionCatalog.contains(permission))) {
            throw new ValidationException("A permissão solicitada não está disponível no catálogo");
        }

        List<RolePermission> previousEntities = permissionRepository.findAllByRoleId(roleId);
        List<WorkspacePermission> previous = previousEntities.stream()
                .map(permission -> new WorkspacePermission(permission.getResource(), permission.getAction()))
                .toList();
        permissionRepository.deleteAllByRoleId(roleId);
        List<RolePermission> replacements = requested.stream().map(permission -> {
            RolePermission rolePermission = new RolePermission();
            rolePermission.setRole(role);
            rolePermission.setResource(permission.resource());
            rolePermission.setAction(permission.action());
            return rolePermission;
        }).toList();
        permissionRepository.saveAllAndFlush(replacements);

        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.ROLE_PERMISSIONS_CHANGED, ActivityResourceType.ROLE, roleId,
                Map.of("previous", previous, "current", requested));
        return new RolePermissionsResponse(role.getId(), role.getName(), requested);
    }

    private Workspace requireOwner(UUID userId, UUID workspaceId) {
        Workspace workspace = workspaceService.requireOwner(userId);
        if (!workspace.getId().equals(workspaceId)) {
            throw new ResourceNotFoundException("Workspace não encontrado");
        }
        return workspace;
    }

    private WorkspaceRole findRole(UUID roleId, UUID workspaceId) {
        return roleRepository.findByIdAndWorkspaceId(roleId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Papel não encontrado"));
    }

    private WorkspaceRole findRoleForUpdate(UUID roleId, UUID workspaceId) {
        return roleRepository.findByIdAndWorkspaceIdForUpdate(roleId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Papel não encontrado"));
    }

    private RolePermissionsResponse response(WorkspaceRole role, List<RolePermission> permissions) {
        return new RolePermissionsResponse(role.getId(), role.getName(), permissions.stream()
                .map(permission -> new WorkspacePermission(permission.getResource(), permission.getAction()))
                .toList());
    }
}
