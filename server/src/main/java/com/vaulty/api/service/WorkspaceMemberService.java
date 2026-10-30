package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.ChangeMemberRoleRequest;
import com.vaulty.api.dto.workspace.WorkspaceMemberResponse;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.mapper.WorkspaceMapper;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceMemberService {

    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceRoleRepository workspaceRoleRepository;
    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceContentAuthorization authorization;
    private final ActivityLogService activityLogService;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponse> list(UUID userId, UUID workspaceId) {
        var workspaceMembers = workspaceMemberRepository.findAllVisibleToMember(workspaceId, userId);

        if (workspaceMembers.isEmpty()) {
            throw new ResourceNotFoundException("Workspace não encontrado");
        }

        boolean includeEmail = workspaceMembers.stream()
                .anyMatch(member -> member.getUser().getId().equals(userId) && member.getRole().isOwnerRole());

        return workspaceMembers.stream()
                .map(member -> workspaceMapper.toResponse(member, includeEmail))
                .toList();
    }

    @Transactional
    public WorkspaceMemberResponse changeRole(UUID userId, UUID workspaceId, UUID memberId,
                                              ChangeMemberRoleRequest request) {
        authorization.requireOwnerForUpdate(userId, workspaceId);
        var owners = workspaceMemberRepository.findOwners(workspaceId, WorkspaceRole.OWNER_ROLE_NAME);
        var member = workspaceMemberRepository.findByIdAndWorkspaceId(memberId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Membro não encontrado"));
        var role = workspaceRoleRepository.findByIdAndWorkspaceId(request.roleId(), workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Papel não encontrado"));
        var previousRole = member.getRole();
        if (previousRole.equals(role)) {
            return workspaceMapper.toResponse(member, true);
        }
        if (previousRole.isOwnerRole() && owners.size() == 1) {
            throw new ConflictException("O workspace precisa manter ao menos um dono");
        }

        member.setRole(role);
        workspaceMemberRepository.saveAndFlush(member);
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.MEMBER_ROLE_CHANGED, ActivityResourceType.MEMBER, memberId,
                Map.of("workspaceMemberId", memberId, "previousRoleId", previousRole.getId(),
                        "roleId", role.getId()));
        notificationService.accessChanged(List.of(member.getUser().getId()));
        return workspaceMapper.toResponse(member, true);
    }
}
