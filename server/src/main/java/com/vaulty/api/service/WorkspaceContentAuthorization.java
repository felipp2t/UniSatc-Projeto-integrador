package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.WorkspacePermission;
import com.vaulty.api.dto.workspace.WorkspacePermissionsResponse;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.exception.ForbiddenException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.RolePermissionRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceContentAuthorization {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository memberRepository;
    private final RolePermissionRepository permissionRepository;
    private final WorkspaceRoleRepository roleRepository;
    private final SystemAdminAuthorization systemAdminAuthorization;

    // O administrador geral age como dono de todos os workspaces, mesmo sem ser membro deles.
    public Workspace requireWorkspace(UUID userId, UUID workspaceId) {
        var workspace = systemAdminAuthorization.isSystemAdmin(userId)
                ? workspaceRepository.findById(workspaceId)
                : workspaceRepository.findByIdAndMemberUserId(workspaceId, userId);
        return workspace.orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
    }

    public Optional<Workspace> findWorkspaceForMember(UUID userId, UUID workspaceId) {
        if (systemAdminAuthorization.isSystemAdmin(userId)) {
            return workspaceRepository.findById(workspaceId);
        }
        return workspaceRepository.findByIdAndMemberUserId(workspaceId, userId);
    }

    public void require(UUID userId, Workspace workspace, String resource, String action) {
        if (!allows(userId, workspace, resource, action)) {
            throw new ForbiddenException("Permissão insuficiente");
        }
    }

    public boolean allows(UUID userId, Workspace workspace, String resource, String action) {
        var role = effectiveRole(userId, workspace.getId());
        if (role.isOwnerRole()) {
            return true;
        }
        return permissionRepository.allows(role.getId(), resource, action);
    }

    public boolean allowsIfMember(UUID userId, UUID workspaceId, String resource, String action) {
        if (systemAdminAuthorization.isSystemAdmin(userId)) {
            return true;
        }
        return memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .map(member -> member.getRole().isOwnerRole()
                        || permissionRepository.allows(member.getRole().getId(), resource, action))
                .orElse(false);
    }

    public boolean isOwner(UUID userId, Workspace workspace) {
        if (systemAdminAuthorization.isSystemAdmin(userId)) {
            return true;
        }
        return memberRepository.findByWorkspaceIdAndUserId(workspace.getId(), userId)
                .map(member -> member.getRole().isOwnerRole())
                .orElse(false);
    }

    // Dono registrado do workspace ou administrador geral.
    public boolean isPrincipalOwner(UUID userId, Workspace workspace) {
        return workspace.isOwnedBy(userId) || systemAdminAuthorization.isSystemAdmin(userId);
    }

    public Workspace requireOwner(UUID userId, UUID workspaceId) {
        Workspace workspace = requireWorkspace(userId, workspaceId);
        if (!isOwner(userId, workspace)) {
            throw new ForbiddenException("Permissão insuficiente");
        }
        return workspace;
    }

    public Workspace requireOwnerOrNotFound(UUID userId, UUID workspaceId) {
        Workspace workspace = requireWorkspace(userId, workspaceId);
        if (!isOwner(userId, workspace)) {
            throw new ResourceNotFoundException("Workspace não encontrado");
        }
        return workspace;
    }

    @Transactional
    public Workspace requireOwnerForUpdate(UUID userId, UUID workspaceId) {
        Workspace workspace = workspaceRepository.findByIdForUpdate(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        if (!effectiveRole(userId, workspaceId).isOwnerRole()) {
            throw new ForbiddenException("Permissão insuficiente");
        }
        return workspace;
    }

    public WorkspacePermissionsResponse permissions(UUID userId, UUID workspaceId) {
        var role = effectiveRole(userId, workspaceId);
        return new WorkspacePermissionsResponse(role.isOwnerRole(), role.getId().toString(),
                role.getName(), rolePermissions(role));
    }

    public List<WorkspacePermission> rolePermissions(WorkspaceRole role) {
        if (role.isOwnerRole()) {
            return PermissionCatalog.effectiveOwnerPermissions();
        }
        return permissionRepository.findAllByRoleId(role.getId()).stream()
                .flatMap(permission -> ("all".equals(permission.getAction())
                        ? PermissionCatalog.actions(permission.getResource()).stream()
                        : Stream.of(permission.getAction()))
                        .map(action -> new WorkspacePermission(permission.getResource(), action)))
                .distinct().toList();
    }

    private WorkspaceRole effectiveRole(UUID userId, UUID workspaceId) {
        if (systemAdminAuthorization.isSystemAdmin(userId)) {
            return roleRepository.findByWorkspaceIdAndName(workspaceId, WorkspaceRole.OWNER_ROLE_NAME)
                    .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        }
        return requireMember(userId, workspaceId).getRole();
    }

    private WorkspaceMember requireMember(UUID userId, UUID workspaceId) {
        return memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
    }
}
