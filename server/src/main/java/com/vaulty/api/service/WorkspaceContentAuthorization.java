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
import java.util.List;
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

    public Workspace requireWorkspace(UUID userId, UUID workspaceId) {
        return workspaceRepository.findByIdAndMemberUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
    }

    public void require(UUID userId, Workspace workspace, String resource, String action) {
        if (!allows(userId, workspace, resource, action)) {
            throw new ForbiddenException("Permissão insuficiente");
        }
    }

    public boolean allows(UUID userId, Workspace workspace, String resource, String action) {
        var role = requireMember(userId, workspace.getId()).getRole();
        if (role.isOwnerRole()) {
            return true;
        }
        return permissionRepository.allows(role.getId(), resource, action);
    }

    public boolean isOwner(UUID userId, Workspace workspace) {
        return memberRepository.findByWorkspaceIdAndUserId(workspace.getId(), userId)
                .map(member -> member.getRole().isOwnerRole())
                .orElse(false);
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
    public void requireOwnerForUpdate(UUID userId, UUID workspaceId) {
        workspaceRepository.findByIdForUpdate(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        var member = requireMember(userId, workspaceId);
        if (!member.getRole().isOwnerRole()) {
            throw new ForbiddenException("Permissão insuficiente");
        }
    }

    public WorkspacePermissionsResponse permissions(UUID userId, UUID workspaceId) {
        var role = requireMember(userId, workspaceId).getRole();
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

    private WorkspaceMember requireMember(UUID userId, UUID workspaceId) {
        return memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
    }
}
