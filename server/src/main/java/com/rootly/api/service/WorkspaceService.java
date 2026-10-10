package com.rootly.api.service;

import com.rootly.api.dto.workspace.UpdateWorkspaceRequest;
import com.rootly.api.dto.workspace.WorkspaceResponse;
import com.rootly.api.entity.User;
import com.rootly.api.entity.Workspace;
import com.rootly.api.entity.WorkspaceRole;
import com.rootly.api.exception.ForbiddenException;
import com.rootly.api.exception.ResourceNotFoundException;
import com.rootly.api.mapper.WorkspaceMapper;
import com.rootly.api.repository.WorkspaceMemberRepository;
import com.rootly.api.repository.WorkspaceRepository;
import com.rootly.api.repository.WorkspaceRoleRepository;
import java.util.List;
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

    @Transactional
    public void addAsMember(User user) {
        Workspace workspace = singleton();
        WorkspaceRole memberRole = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspace.getId(), WorkspaceRole.MEMBER_ROLE_NAME)
                .orElseThrow(() -> new ResourceNotFoundException("Papel padrão do workspace não encontrado"));

        workspaceMemberRepository.save(workspaceMapper.toMember(user, workspace, memberRole));
    }

    @Transactional(readOnly = true)
    public void requireOwner(UUID userId) {
        if (!singleton().getOwner().getId().equals(userId)) {
            throw new ForbiddenException("Apenas o dono do workspace pode executar esta ação");
        }
    }

    // null se o usuario ainda nao tiver vinculo com o workspace (nao deveria acontecer em uso normal)
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

        workspaceMapper.update(request, workspace);
        workspaceRepository.saveAndFlush(workspace);

        return workspaceMapper.toResponse(workspace);
    }

    private Workspace singleton() {
        return workspaceRepository.findSingleton()
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
    }
}
