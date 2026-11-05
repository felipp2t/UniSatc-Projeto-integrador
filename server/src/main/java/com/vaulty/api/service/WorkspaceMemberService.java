package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.ChangeMemberRoleRequest;
import com.vaulty.api.dto.workspace.ReadmitMemberRequest;
import com.vaulty.api.dto.workspace.TransferOwnershipRequest;
import com.vaulty.api.dto.workspace.WorkspaceMemberResponse;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.enums.GlobalRole;
import jakarta.persistence.EntityManager;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.mapper.WorkspaceMapper;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
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
    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceContentAuthorization authorization;
    private final ActivityLogService activityLogService;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceService workspaceService;
    private final WorkspaceAccessNotifications accessNotifications;
    private final NotificationService notificationService;
    private final EntityManager entityManager;

    @Transactional
    public WorkspaceMemberResponse readmit(UUID userId, UUID workspaceId, ReadmitMemberRequest request) {
        workspaceService.lockWorkspace(workspaceId);
        entityManager.clear();
        var workspace = workspaceService.requireMemberManager(userId, workspaceId);
        var user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResourceNotFoundException("Conta não encontrada"));
        if (workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, user.getId()).isPresent()) {
            throw new ConflictException("Conta já é membro do workspace");
        }

        var member = workspaceMemberRepository.save(workspaceMapper.toMember(user, workspace));
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.MEMBER_JOINED, ActivityResourceType.MEMBER, member.getId(),
                Map.of("workspaceMemberId", member.getId(), "userId", user.getId(),
                        "name", user.getName(), "email", user.getEmail(), "role", "Sem papel"));
        notificationService.accessChanged(List.of(user.getId()));
        return toResponse(member, true);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponse> list(UUID userId, UUID workspaceId) {
        var workspaceMembers = workspaceMemberRepository.findAllVisibleToMember(workspaceId, userId);

        if (workspaceMembers.isEmpty()) {
            throw new ResourceNotFoundException("Workspace não encontrado");
        }

        boolean includeEmail = workspaceMembers.stream()
                .filter(member -> member.getUser().getId().equals(userId))
                .anyMatch(member -> authorization.isOwner(userId, member.getWorkspace())
                        || member.getGlobalRole() == GlobalRole.ADMIN);

        return workspaceMembers.stream()
                .map(member -> toResponse(member, includeEmail))
                .toList();
    }

    @Transactional
    public WorkspaceMemberResponse changeRole(UUID userId, UUID workspaceId, UUID memberId,
                                              ChangeMemberRoleRequest request) {
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        var workspace = authorization.requireOwnerForUpdate(userId, workspaceId);
        var member = workspaceMemberRepository.findByIdAndWorkspaceId(memberId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Membro não encontrado"));
        if (authorization.isOwner(member.getUser().getId(), workspace)) {
            throw new ConflictException("Transfira a titularidade antes de alterar o papel do Owner");
        }

        GlobalRole previousRole = member.getGlobalRole();
        GlobalRole nextRole = request.globalRole();
        String previousRoleName = roleName(member);
        if (nextRole == null && previousRole == null && member.getTeam() != null) {
            return toResponse(member, true);
        }
        if (previousRole == nextRole && member.getTeam() == null && member.getRole() == null) {
            return toResponse(member, true);
        }
        if (nextRole != null && isTeamLeader(member)) {
            throw new ConflictException("Transfira a liderança do time antes de atribuir um papel global");
        }

        var before = accessNotifications.snapshot(workspaceId);
        if (nextRole != null || previousRole != null) {
            member.setRole(null);
            member.setTeam(null);
            member.setGlobalRole(nextRole);
        }
        workspaceMemberRepository.saveAndFlush(member);
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.MEMBER_ROLE_CHANGED, ActivityResourceType.MEMBER, memberId,
                Map.of("workspaceMemberId", memberId,
                        "previousRole", previousRoleName == null ? "Sem papel" : previousRoleName,
                        "role", nextRole == null ? "Sem papel" : nextRole.displayName()));
        accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspaceId),
                List.of(member.getUser().getId()));
        return toResponse(member, true);
    }

    @Transactional
    public WorkspaceMemberResponse transferOwnership(
            UUID userId, UUID workspaceId, TransferOwnershipRequest request) {
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        Workspace workspace = authorization.requireOwnerForUpdate(userId, workspaceId);
        WorkspaceMember successor = workspaceMemberRepository.findByIdAndWorkspaceId(request.memberId(), workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Membro não encontrado"));
        if (authorization.isOwner(successor.getUser().getId(), workspace)) {
            throw new ConflictException("O membro já é o Owner do workspace");
        }
        if (isTeamLeader(successor)) {
            throw new ConflictException("Transfira a liderança do time antes de transferir a titularidade");
        }

        WorkspaceMember previousOwner = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Membro não encontrado"));
        var before = accessNotifications.snapshot(workspaceId);
        String successorPreviousRole = roleName(successor);

        successor.setRole(null);
        successor.setTeam(null);
        successor.setGlobalRole(null);
        workspaceMemberRepository.saveAndFlush(successor);

        workspace.setOwner(successor.getUser());
        workspaceRepository.saveAndFlush(workspace);

        previousOwner.setRole(null);
        previousOwner.setTeam(null);
        previousOwner.setGlobalRole(GlobalRole.ADMIN);
        workspaceMemberRepository.saveAndFlush(previousOwner);

        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.MEMBER_ROLE_CHANGED, ActivityResourceType.MEMBER, previousOwner.getId(),
                Map.of("workspaceMemberId", previousOwner.getId(), "previousRole", "Owner", "role", "Admin"));
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.MEMBER_ROLE_CHANGED, ActivityResourceType.MEMBER, successor.getId(),
                Map.of("workspaceMemberId", successor.getId(),
                        "previousRole", successorPreviousRole == null ? "Sem papel" : successorPreviousRole,
                        "role", "Owner"));
        accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspaceId),
                List.of(userId, successor.getUser().getId()));
        return toResponse(successor, true);
    }

    @Transactional
    public void remove(UUID userId, UUID workspaceId, UUID membershipId, UUID confirmMemberId) {
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        var workspace = authorization.requireOwnerForUpdate(userId, workspaceId);
        if (confirmMemberId == null || !membershipId.equals(confirmMemberId)) {
            throw new ValidationException("Confirmação deve identificar o membro removido");
        }
        var member = workspaceMemberRepository.findByIdAndWorkspaceId(membershipId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Membro não encontrado"));
        var removedUser = member.getUser();
        if (authorization.isOwner(member.getUser().getId(), workspace)) {
            throw new ConflictException("Transfira a titularidade antes de remover o Owner");
        }
        if (isTeamLeader(member)) {
            throw new ConflictException("Transfira a liderança do time antes de remover o membro");
        }
        var before = accessNotifications.snapshot(workspaceId);
        String removedRole = roleName(member);
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER, ActivityAction.MEMBER_REMOVED,
                ActivityResourceType.MEMBER, membershipId,
                Map.of("userId", removedUser.getId(), "name", removedUser.getName(),
                        "email", removedUser.getEmail(), "role",
                        removedRole == null ? "Sem papel" : removedRole));
        workspaceMemberRepository.delete(member);
        accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspaceId));
    }

    private WorkspaceMemberResponse toResponse(WorkspaceMember member, boolean includeEmail) {
        boolean owner = authorization.isOwner(member.getUser().getId(), member.getWorkspace());
        boolean leader = isTeamLeader(member);
        String roleName = owner ? "Owner"
                : member.getGlobalRole() != null ? member.getGlobalRole().displayName()
                : member.getTeam() == null ? null : leader ? "Leader" : "Member";
        return new WorkspaceMemberResponse(
                member.getId(), member.getUser().getId(), member.getUser().getName(),
                includeEmail ? member.getUser().getEmail() : null,
                member.getGlobalRole(), member.getTeam() == null ? null : member.getTeam().getId(), leader, roleName);
    }

    private String roleName(WorkspaceMember member) {
        boolean owner = authorization.isOwner(member.getUser().getId(), member.getWorkspace());
        return owner ? "Owner"
                : member.getGlobalRole() != null ? member.getGlobalRole().displayName()
                : member.getTeam() == null ? null
                : isTeamLeader(member) ? "Leader" : "Member";
    }

    private boolean isTeamLeader(WorkspaceMember member) {
        return member.getTeam() != null
                && member.getTeam().getLeader().getId().equals(member.getId());
    }

}
