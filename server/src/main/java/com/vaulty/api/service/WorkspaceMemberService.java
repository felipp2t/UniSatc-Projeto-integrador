package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.ChangeMemberRoleRequest;
import com.vaulty.api.dto.workspace.WorkspaceMemberResponse;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.mapper.WorkspaceMapper;
import com.vaulty.api.repository.WorkspaceRepository;
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
    private final WorkspaceRepository workspaceRepository;

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

    @Transactional
    public void remove(UUID userId, UUID workspaceId, UUID membershipId, UUID confirmMemberId) {
        var workspace = workspaceRepository.findByIdForUpdate(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        authorization.requireOwner(userId, workspaceId);
        if (confirmMemberId == null || !membershipId.equals(confirmMemberId)) {
            throw new ValidationException("Confirmação deve identificar o membro removido");
        }
        var member = workspaceMemberRepository.findByIdAndWorkspaceId(membershipId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Membro não encontrado"));
        if (member.getRole().isOwnerRole()) {
            var owners = workspaceMemberRepository.findOwners(workspaceId, WorkspaceRole.OWNER_ROLE_NAME);
            var otherOwners = owners.stream()
                    .filter(owner -> !owner.getId().equals(membershipId))
                    .toList();
            if (otherOwners.isEmpty()) {
                throw new ConflictException("O workspace precisa manter ao menos um dono");
            }
            if (workspace.getOwner().getId().equals(member.getUser().getId())) {
                workspace.setOwner(otherOwners.get(0).getUser());
                workspaceRepository.save(workspace);
            }
        }
        var removedUser = member.getUser();
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER, ActivityAction.MEMBER_REMOVED,
                ActivityResourceType.MEMBER, membershipId,
                Map.of("userId", removedUser.getId(), "name", removedUser.getName(),
                        "email", removedUser.getEmail(), "role", member.getRole().getName()));
        workspaceMemberRepository.delete(member);
    }
}
