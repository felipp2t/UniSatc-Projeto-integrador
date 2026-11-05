package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.UpdateWorkspaceRequest;
import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.mapper.WorkspaceMapper;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceMapper workspaceMapper;
    private final ActivityLogService activityLogService;
    private final WorkspaceContentAuthorization authorization;
    private final NotificationService notificationService;

    @Transactional
    public WorkspaceMember addAsMember(User user) {
        Workspace workspace = singleton();
        workspace = workspaceRepository.findByIdForUpdate(workspace.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        WorkspaceMember member = workspaceMemberRepository.save(workspaceMapper.toMember(user, workspace));
        notificationService.accessChanged(List.of(user.getId()));
        return member;
    }

    public void lockWorkspace(UUID workspaceId) {
        workspaceRepository.findByIdForUpdate(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
    }

    @Transactional
    public void lockSingletonForUpdate() {
        lockWorkspace(singleton().getId());
    }

    @Transactional(readOnly = true)
    public Workspace requireOwner(UUID userId) {
        Workspace workspace = singleton();
        return authorization.requireOwner(userId, workspace.getId());
    }

    @Transactional(readOnly = true)
    public Workspace requireInviteManager(UUID userId) {
        Workspace workspace = singleton();
        authorization.require(userId, workspace, "member", "invite");
        return workspace;
    }

    @Transactional
    public Workspace requireInviteManagerForUpdate(UUID userId) {
        Workspace workspace = singleton();
        workspace = workspaceRepository.findByIdForUpdate(workspace.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        authorization.require(userId, workspace, "member", "invite");
        return workspace;
    }

    @Transactional(readOnly = true)
    public Workspace requireMemberManager(UUID userId, UUID workspaceId) {
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "member", "manage");
        return workspace;
    }

    @Transactional(readOnly = true)
    public UUID singletonId() {
        return singleton().getId();
    }

    @Transactional(readOnly = true)
    public String getRoleName(UUID userId) {
        return workspaceMemberRepository.findByUserId(userId)
                .map(member -> {
                    if (authorization.isOwner(userId, member.getWorkspace())) {
                        return "Owner";
                    }
                    if (member.getGlobalRole() != null) {
                        return member.getGlobalRole().displayName();
                    }
                    if (member.getTeam() == null) {
                        return null;
                    }
                    return authorization.isTeamLeader(member) ? "Leader" : "Member";
                })
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceResponse> list(UUID userId) {
        return workspaceRepository.findAllByMemberUserId(userId).stream()
                .map(workspaceMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkspaceResponse get(UUID userId, UUID workspaceId) {
        Workspace workspace = workspaceRepository.findByIdAndMemberUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));

        return workspaceMapper.toResponse(workspace);
    }

    @Transactional
    public WorkspaceResponse update(UUID ownerId, UUID workspaceId, UpdateWorkspaceRequest request) {
        Workspace workspace = workspaceRepository.findByIdForUpdate(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        if (!authorization.isOwner(ownerId, workspace)) {
            throw new ResourceNotFoundException("Workspace não encontrado");
        }

        Map<String, Object> previous = new LinkedHashMap<>();
        previous.put("name", workspace.getName());
        previous.put("description", workspace.getDescription());
        workspaceMapper.update(request, workspace);
        workspaceRepository.saveAndFlush(workspace);
        Map<String, Object> current = new LinkedHashMap<>();
        current.put("name", workspace.getName());
        current.put("description", workspace.getDescription());
        activityLogService.record(workspaceId, ownerId, ActivityActorContext.USER,
                ActivityAction.WORKSPACE_RENAMED, ActivityResourceType.WORKSPACE, workspaceId,
                Map.of("previous", previous, "current", current));

        return workspaceMapper.toResponse(workspace);
    }

    private Workspace singleton() {
        return workspaceRepository.findSingleton()
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
    }
}
