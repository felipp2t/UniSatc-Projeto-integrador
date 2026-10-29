package com.vaulty.api.service;

import com.vaulty.api.dto.accessgroup.AccessGroupMemberResponse;
import com.vaulty.api.dto.accessgroup.AccessGroupRequest;
import com.vaulty.api.dto.accessgroup.AccessGroupResponse;
import com.vaulty.api.entity.AccessGroup;
import com.vaulty.api.entity.AccessGroupMember;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.AccessGroupMemberRepository;
import com.vaulty.api.repository.AccessGroupRepository;
import com.vaulty.api.repository.PersistenceConstraints;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AccessGroupService {

    private static final String DUPLICATE_NAME_CONSTRAINT = "uq_access_group_workspace_name";
    private static final String GROUP_MEMBER_FK = "fk_access_group_member_group_workspace";

    private final AccessGroupRepository groupRepository;
    private final AccessGroupMemberRepository groupMemberRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceContentAuthorization authorization;
    private final ActivityLogService activityLogService;

    @Transactional
    public AccessGroupResponse create(UUID userId, UUID workspaceId, AccessGroupRequest request) {
        var workspace = requireManager(userId, workspaceId);
        var group = new AccessGroup();
        group.setWorkspace(workspace);
        group.setName(request.name());
        try {
            group = groupRepository.saveAndFlush(group);
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, DUPLICATE_NAME_CONSTRAINT)) {
                throw new ConflictException("Já existe um grupo com esse nome neste workspace");
            }
            throw exception;
        }
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.GROUP_CREATED, ActivityResourceType.GROUP, group.getId(),
                Map.of("groupId", group.getId()));
        return toResponse(group);
    }

    @Transactional(readOnly = true)
    public List<AccessGroupResponse> list(UUID userId, UUID workspaceId) {
        requireManager(userId, workspaceId);
        return groupRepository.findAllByWorkspaceIdOrderByNameAscIdAsc(workspaceId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public AccessGroupResponse rename(UUID userId, UUID workspaceId, UUID groupId, AccessGroupRequest request) {
        requireManager(userId, workspaceId);
        var group = findGroupForUpdate(groupId, workspaceId);
        String previousName = group.getName();
        if (previousName.equals(request.name())) {
            return toResponse(group);
        }
        group.setName(request.name());
        try {
            group = groupRepository.saveAndFlush(group);
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, DUPLICATE_NAME_CONSTRAINT)) {
                throw new ConflictException("Já existe um grupo com esse nome neste workspace");
            }
            throw exception;
        }
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.GROUP_RENAMED, ActivityResourceType.GROUP, groupId,
                Map.of("groupId", groupId, "previousName", previousName, "name", group.getName()));
        return toResponse(group);
    }

    @Transactional
    public void delete(UUID userId, UUID workspaceId, UUID groupId) {
        requireManager(userId, workspaceId);
        var group = findGroupForUpdate(groupId, workspaceId);
        if (groupMemberRepository.existsByGroupIdAndWorkspaceId(groupId, workspaceId)) {
            throw new ConflictException("Remova os integrantes antes de excluir o grupo");
        }
        try {
            groupRepository.delete(group);
            groupRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, GROUP_MEMBER_FK)) {
                throw new ConflictException("Remova os integrantes antes de excluir o grupo");
            }
            throw exception;
        }
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.GROUP_DELETED, ActivityResourceType.GROUP, groupId,
                Map.of("groupId", groupId));
    }

    @Transactional(readOnly = true)
    public List<AccessGroupMemberResponse> listMembers(UUID userId, UUID workspaceId, UUID groupId) {
        requireManager(userId, workspaceId);
        requireGroup(groupId, workspaceId);
        return groupMemberRepository.findAllByGroupIdAndWorkspaceId(groupId, workspaceId).stream()
                .map(member -> new AccessGroupMemberResponse(
                        member.getWorkspaceMember().getId(),
                        member.getWorkspaceMember().getUser().getId(),
                        member.getWorkspaceMember().getUser().getName(),
                        member.getWorkspaceMember().getUser().getEmail()))
                .toList();
    }

    @Transactional
    public void addMember(UUID userId, UUID workspaceId, UUID groupId, UUID workspaceMemberId) {
        requireManager(userId, workspaceId);
        var group = findGroupForUpdate(groupId, workspaceId);
        var workspaceMember = workspaceMemberRepository.findByIdAndWorkspaceId(workspaceMemberId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Integrante do workspace não encontrado"));
        if (groupMemberRepository.findByGroupIdAndWorkspaceIdAndWorkspaceMemberId(
                groupId, workspaceId, workspaceMemberId).isPresent()) {
            return;
        }
        var groupMember = new AccessGroupMember();
        groupMember.setGroup(group);
        groupMember.setWorkspaceMember(workspaceMember);
        groupMember.setWorkspaceId(workspaceId);
        groupMemberRepository.saveAndFlush(groupMember);
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.GROUP_MEMBER_ADDED, ActivityResourceType.GROUP, groupId,
                Map.of("groupId", groupId, "workspaceMemberId", workspaceMemberId));
    }

    @Transactional
    public void removeMember(UUID userId, UUID workspaceId, UUID groupId, UUID workspaceMemberId) {
        requireManager(userId, workspaceId);
        findGroupForUpdate(groupId, workspaceId);
        var groupMember = groupMemberRepository.findByGroupIdAndWorkspaceIdAndWorkspaceMemberId(
                groupId, workspaceId, workspaceMemberId);
        if (groupMember.isEmpty()) {
            return;
        }
        groupMemberRepository.delete(groupMember.get());
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.GROUP_MEMBER_REMOVED, ActivityResourceType.GROUP, groupId,
                Map.of("groupId", groupId, "workspaceMemberId", workspaceMemberId));
    }

    private Workspace requireManager(UUID userId, UUID workspaceId) {
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "group", "manage");
        return workspace;
    }

    private AccessGroup findGroupForUpdate(UUID groupId, UUID workspaceId) {
        return groupRepository.findByIdAndWorkspaceIdForUpdate(groupId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Grupo não encontrado"));
    }

    private void requireGroup(UUID groupId, UUID workspaceId) {
        if (!groupRepository.existsByIdAndWorkspaceId(groupId, workspaceId)) {
            throw new ResourceNotFoundException("Grupo não encontrado");
        }
    }

    private AccessGroupResponse toResponse(AccessGroup group) {
        return new AccessGroupResponse(group.getId(), group.getName());
    }
}
