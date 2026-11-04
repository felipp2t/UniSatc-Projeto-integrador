package com.vaulty.api.service;

import com.vaulty.api.dto.admin.AdminInviteRequest;
import com.vaulty.api.dto.admin.AdminWorkspaceDetailResponse;
import com.vaulty.api.dto.admin.AdminWorkspaceResponse;
import com.vaulty.api.dto.workspace.CreateWorkspaceRequest;
import com.vaulty.api.dto.workspace.UpdateWorkspaceRequest;
import com.vaulty.api.dto.workspace.WorkspaceMemberResponse;
import com.vaulty.api.mapper.WorkspaceMapper;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.UserInviteStatus;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.UserInviteRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminWorkspaceService {

    private final SystemAdminAuthorization systemAdminAuthorization;
    private final WorkspaceService workspaceService;
    private final InviteService inviteService;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserInviteRepository userInviteRepository;
    private final WorkspaceMapper workspaceMapper;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<AdminWorkspaceResponse> list(UUID adminId) {
        systemAdminAuthorization.require(adminId);
        return workspaceRepository.findAllWithOwner().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AdminWorkspaceResponse create(UUID adminId, CreateWorkspaceRequest request) {
        systemAdminAuthorization.require(adminId);
        Workspace workspace = workspaceService.createWithDefaultRoles(request.name(), request.description());
        return toResponse(workspace);
    }

    @Transactional(readOnly = true)
    public AdminWorkspaceDetailResponse get(UUID adminId, UUID workspaceId) {
        systemAdminAuthorization.require(adminId);
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        List<WorkspaceMemberResponse> members = workspaceMemberRepository.findAllWithUserAndRole(workspaceId)
                .stream()
                .map(member -> workspaceMapper.toResponse(member, true))
                .toList();
        return new AdminWorkspaceDetailResponse(toResponse(workspace), members);
    }

    @Transactional
    public AdminWorkspaceResponse update(UUID adminId, UUID workspaceId, UpdateWorkspaceRequest request) {
        systemAdminAuthorization.require(adminId);
        Workspace workspace = workspaceRepository.findByIdForUpdate(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        workspaceMapper.update(request, workspace);
        workspaceRepository.saveAndFlush(workspace);
        return toResponse(workspace);
    }

    @Transactional
    public void invite(UUID adminId, UUID workspaceId, AdminInviteRequest request) {
        systemAdminAuthorization.require(adminId);
        Workspace workspace = workspaceRepository.findByIdForUpdate(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        inviteService.inviteToWorkspace(adminId, workspace, request.email(), request.owner());
    }

    @Transactional
    public void revokeInvite(UUID adminId, UUID workspaceId, UUID inviteId) {
        systemAdminAuthorization.require(adminId);
        inviteService.revokeInWorkspace(adminId, workspaceId, inviteId);
    }

    private AdminWorkspaceResponse toResponse(Workspace workspace) {
        User owner = workspace.getOwner();
        return new AdminWorkspaceResponse(
                workspace.getId(),
                workspace.getName(),
                workspace.getDescription(),
                owner == null ? null : owner.getName(),
                owner == null ? null : owner.getEmail(),
                workspaceMemberRepository.countByWorkspaceId(workspace.getId()),
                userInviteRepository.findPendingByWorkspace(
                        workspace.getId(), OffsetDateTime.now(clock), UserInviteStatus.PENDING),
                workspace.getCreatedAt());
    }
}
