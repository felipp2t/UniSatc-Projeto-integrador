package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.CreateWorkspaceRequest;
import com.vaulty.api.dto.workspace.UpdateWorkspaceRequest;
import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.mapper.WorkspaceMapper;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
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

        var ownerRole = workspaceRoleRepository.save(WorkspaceRole.owner(workspace));
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

    @Transactional
    public WorkspaceResponse update(UUID ownerId, UUID workspaceId, UpdateWorkspaceRequest request) {
        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));

        workspaceMapper.update(request, workspace);
        workspaceRepository.saveAndFlush(workspace);

        return workspaceMapper.toResponse(workspace);
    }
}
