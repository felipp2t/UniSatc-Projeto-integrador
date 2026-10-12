package com.vaulty.api.service;

import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.exception.ForbiddenException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.RolePermissionRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
        if (workspace.getOwner().getId().equals(userId)) {
            return true;
        }
        var member = memberRepository.findByWorkspaceIdAndUserId(workspace.getId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        var role = member.getRole();
        if (WorkspaceRole.MEMBER_ROLE_NAME.equals(role.getName())) {
            return "read".equals(action) && ("item".equals(resource) || "collection".equals(resource));
        }
        return permissionRepository.allows(role.getId(), resource, action);
    }
}
