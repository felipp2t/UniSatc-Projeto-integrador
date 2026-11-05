package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.WorkspacePermission;
import com.vaulty.api.dto.workspace.WorkspacePermissionsResponse;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.enums.GlobalRole;
import com.vaulty.api.exception.ForbiddenException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import com.vaulty.api.repository.WorkspaceTeamRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceContentAuthorization {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository memberRepository;
    private final WorkspaceTeamRepository teamRepository;

    public Workspace requireWorkspace(UUID userId, UUID workspaceId) {
        return workspaceRepository.findByIdAndMemberUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
    }

    public Optional<Workspace> findWorkspaceForMember(UUID userId, UUID workspaceId) {
        return workspaceRepository.findByIdAndMemberUserId(workspaceId, userId);
    }

    public void require(UUID userId, Workspace workspace, String resource, String action) {
        if (!allows(userId, workspace, resource, action)) {
            throw new ForbiddenException("Permissão insuficiente");
        }
    }

    public boolean allows(UUID userId, Workspace workspace, String resource, String action) {
        WorkspaceMember member = requireMember(userId, workspace.getId());
        return PermissionCatalog.allows(permissionsFor(userId, workspace, member), resource, action);
    }

    public boolean allowsIfMember(UUID userId, UUID workspaceId, String resource, String action) {
        return memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .map(member -> allows(member.getUser().getId(), member.getWorkspace(), resource, action))
                .orElse(false);
    }

    public boolean isOwner(UUID userId, Workspace workspace) {
        return workspace.getOwner().getId().equals(userId);
    }

    public boolean isTeamLeader(WorkspaceMember member) {
        return member.getTeam() != null
                && teamRepository.existsByIdAndLeader_Id(member.getTeam().getId(), member.getId());
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
        if (!isOwner(userId, workspace)) {
            throw new ForbiddenException("Permissão insuficiente");
        }
        return workspace;
    }

    public WorkspacePermissionsResponse permissions(UUID userId, UUID workspaceId) {
        Workspace workspace = requireWorkspace(userId, workspaceId);
        WorkspaceMember member = requireMember(userId, workspaceId);
        boolean owner = isOwner(userId, workspace);
        boolean leader = isTeamLeader(member);
        String roleName = owner ? "Owner"
                : member.getGlobalRole() != null ? member.getGlobalRole().displayName()
                : member.getTeam() == null ? null : leader ? "Leader" : "Member";
        List<WorkspacePermission> permissions = permissionsFor(userId, workspace, member);
        return new WorkspacePermissionsResponse(
                owner,
                member.getGlobalRole() == null ? null : member.getGlobalRole().name(),
                member.getTeam() == null ? null : member.getTeam().getId(),
                leader,
                member.getRole() == null ? null : member.getRole().getId().toString(),
                roleName,
                permissions);
    }

    public List<WorkspacePermission> rolePermissions(WorkspaceRole role) {
        return role.isOwnerRole() ? PermissionCatalog.effectiveOwnerPermissions() : List.of();
    }

    private WorkspaceMember requireMember(UUID userId, UUID workspaceId) {
        return memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
    }

    private List<WorkspacePermission> permissionsFor(
            UUID userId, Workspace workspace, WorkspaceMember member) {
        if (isOwner(userId, workspace)) {
            return PermissionCatalog.effectiveOwnerPermissions();
        }
        if (member.getGlobalRole() != null) {
            return PermissionCatalog.permissionsForGlobalRole(member.getGlobalRole());
        }
        return member.getTeam() == null ? List.of()
                : PermissionCatalog.permissionsForTeamRole(isTeamLeader(member));
    }
}
