package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.ChangeMemberRoleRequest;
import com.vaulty.api.dto.workspace.ReadmitMemberRequest;
import com.vaulty.api.dto.workspace.WorkspaceMemberResponse;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.entity.User;
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
import com.vaulty.api.repository.UserRepository;
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
    private final UserRepository userRepository;
    private final WorkspaceRoleRepository workspaceRoleRepository;
    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceContentAuthorization authorization;
    private final ActivityLogService activityLogService;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceAccessNotifications accessNotifications;
    private final NotificationService notificationService;

    @Transactional
    public WorkspaceMemberResponse readmit(UUID userId, UUID workspaceId, ReadmitMemberRequest request) {
        var workspace = authorization.requireOwnerForUpdate(userId, workspaceId);
        var user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResourceNotFoundException("Conta não encontrada"));
        if (workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, user.getId()).isPresent()) {
            throw new ConflictException("Conta já é membro do workspace");
        }
        var memberRole = workspaceRoleRepository.findByWorkspaceIdAndName(workspaceId, WorkspaceRole.MEMBER_ROLE_NAME)
                .orElseThrow(() -> new ResourceNotFoundException("Papel padrão do workspace não encontrado"));

        var member = workspaceMemberRepository.save(workspaceMapper.toMember(user, workspace, memberRole));
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.MEMBER_JOINED, ActivityResourceType.MEMBER, member.getId(),
                Map.of("workspaceMemberId", member.getId(), "userId", user.getId(),
                        "name", user.getName(), "email", user.getEmail(), "role", memberRole.getName()));
        notificationService.accessChanged(List.of(user.getId()));
        return workspaceMapper.toResponse(member, true);
    }

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
        var workspace = authorization.requireOwnerForUpdate(userId, workspaceId);
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

        var before = accessNotifications.snapshot(workspaceId);
        member.setRole(role);
        if (previousRole.isOwnerRole() && workspace.getOwner().getId().equals(member.getUser().getId())) {
            var successor = owners.stream()
                    .filter(owner -> !owner.getId().equals(memberId))
                    .findFirst()
                    .orElseThrow(() -> new ConflictException("O workspace precisa manter ao menos um dono"));
            workspace.setOwner(successor.getUser());
            workspaceRepository.save(workspace);
        }
        workspaceMemberRepository.saveAndFlush(member);
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.MEMBER_ROLE_CHANGED, ActivityResourceType.MEMBER, memberId,
                Map.of("workspaceMemberId", memberId, "previousRoleId", previousRole.getId(),
                        "roleId", role.getId()));
        accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspaceId),
                List.of(member.getUser().getId()));
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
        var removedUser = member.getUser();
        User successor = null;
        if (member.getRole().isOwnerRole()) {
            var owners = workspaceMemberRepository.findOwners(workspaceId, WorkspaceRole.OWNER_ROLE_NAME);
            var otherOwners = owners.stream()
                    .filter(owner -> !owner.getId().equals(membershipId))
                    .toList();
            if (otherOwners.isEmpty()) {
                throw new ConflictException("O workspace precisa manter ao menos um dono");
            }
            if (workspace.getOwner().getId().equals(member.getUser().getId())) {
                successor = otherOwners.get(0).getUser();
            }
        }
        var before = accessNotifications.snapshot(workspaceId);
        if (successor != null) {
            workspace.setOwner(successor);
            workspaceRepository.save(workspace);
        }
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER, ActivityAction.MEMBER_REMOVED,
                ActivityResourceType.MEMBER, membershipId,
                Map.of("userId", removedUser.getId(), "name", removedUser.getName(),
                        "email", removedUser.getEmail(), "role", member.getRole().getName()));
        workspaceMemberRepository.delete(member);
        accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspaceId));
    }
}
