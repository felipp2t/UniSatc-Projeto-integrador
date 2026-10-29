package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.WorkspacePermission;
import com.vaulty.api.dto.workspace.WorkspacePermissionsResponse;
import com.vaulty.api.entity.Workspace;
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

@Service
@RequiredArgsConstructor
public class WorkspaceContentAuthorization {

    private static final List<String> RESOURCES =
            List.of("workspace", "collection", "item", "member", "role", "activity");
    private static final List<String> ACTIONS = List.of("read", "create", "update", "delete", "invite");

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
        if (workspace.getOwner().getId().equals(userId)) {
            return true;
        }
        var member = memberRepository.findByWorkspaceIdAndUserId(workspace.getId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        return permissionRepository.allows(member.getRole().getId(), resource, action);
    }

    public WorkspacePermissionsResponse permissions(UUID userId, UUID workspaceId) {
        Workspace workspace = requireWorkspace(userId, workspaceId);
        boolean isOwner = workspace.getOwner().getId().equals(userId);
        var member = memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        List<WorkspacePermission> permissions;
        if (isOwner) {
            permissions = Stream.concat(RESOURCES.stream().flatMap(resource -> ACTIONS.stream()
                            .map(action -> new WorkspacePermission(resource, action))),
                    Stream.of(new WorkspacePermission("group", "manage"))).toList();
        } else {
            permissions = permissionRepository.findAllByRoleId(member.getRole().getId()).stream()
                    .flatMap(permission -> ("all".equals(permission.getAction())
                            ? ("group".equals(permission.getResource()) ? Stream.of("manage") : ACTIONS.stream())
                            : Stream.of(permission.getAction()))
                            .map(action -> new WorkspacePermission(permission.getResource(), action)))
                    .distinct().toList();
        }
        return new WorkspacePermissionsResponse(isOwner, member.getRole().getId().toString(),
                member.getRole().getName(), permissions);
    }
}
