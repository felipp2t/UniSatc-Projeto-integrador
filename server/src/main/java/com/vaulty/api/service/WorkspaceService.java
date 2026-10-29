package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.UpdateWorkspaceRequest;
import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ForbiddenException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.mapper.WorkspaceMapper;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
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
    private final WorkspaceRoleRepository workspaceRoleRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceMapper workspaceMapper;
    private final ActivityLogService activityLogService;

    @Transactional
    public WorkspaceMember addAsMember(User user) {
        Workspace workspace = singleton();
        WorkspaceRole memberRole = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspace.getId(), WorkspaceRole.MEMBER_ROLE_NAME)
                .orElseThrow(() -> new ResourceNotFoundException("Papel padrão do workspace não encontrado"));

        return workspaceMemberRepository.save(workspaceMapper.toMember(user, workspace, memberRole));
    }

    @Transactional(readOnly = true)
    public Workspace requireOwner(UUID userId) {
        Workspace workspace = singleton();
        if (!workspace.getOwner().getId().equals(userId)) {
            throw new ForbiddenException("Apenas o dono do workspace pode executar esta ação");
        }
        return workspace;
    }

    @Transactional(readOnly = true)
    public UUID singletonId() {
        return singleton().getId();
    }

    // Usuários anteriores ao vínculo obrigatório podem não ter papel no workspace.
    @Transactional(readOnly = true)
    public String getRoleName(UUID userId) {
        return workspaceMemberRepository.findByUserId(userId)
                .map(member -> member.getRole().getName())
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
        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));

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
