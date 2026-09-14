package com.rootly.api.service;

import com.rootly.api.dto.workspace.CreateWorkspaceRequest;
import com.rootly.api.dto.workspace.WorkspaceResponse;
import com.rootly.api.entity.User;
import com.rootly.api.entity.Workspace;
import com.rootly.api.exception.ResourceNotFoundException;
import com.rootly.api.mapper.WorkspaceMapper;
import com.rootly.api.repository.UserRepository;
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

    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceRoleRepository workspaceRoleRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceMapper workspaceMapper;

    @Transactional
    public WorkspaceResponse create(UUID ownerId, CreateWorkspaceRequest request) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

        Workspace workspace = workspaceMapper.toEntity(request);
        workspace.setOwner(owner);
        workspaceRepository.saveAndFlush(workspace);

        var ownerRole = workspaceRoleRepository.save(workspaceMapper.toOwnerRole(workspace));
        workspaceMemberRepository.save(workspaceMapper.toMember(owner, workspace, ownerRole));

        return workspaceMapper.toResponse(workspace);
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
}
