package com.rootly.api.service;

import com.rootly.api.dto.workspace.CreateWorkspaceRequest;
import com.rootly.api.entity.User;
import com.rootly.api.entity.Workspace;
import com.rootly.api.entity.WorkspaceMember;
import com.rootly.api.entity.WorkspaceRole;
import com.rootly.api.exception.ResourceNotFoundException;
import com.rootly.api.repository.UserRepository;
import com.rootly.api.repository.WorkspaceMemberRepository;
import com.rootly.api.repository.WorkspaceRepository;
import com.rootly.api.repository.WorkspaceRoleRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceService {

    private static final String OWNER_ROLE_NAME = "Owner";

    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceRoleRepository workspaceRoleRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    public WorkspaceService(
            UserRepository userRepository,
            WorkspaceRepository workspaceRepository,
            WorkspaceRoleRepository workspaceRoleRepository,
            WorkspaceMemberRepository workspaceMemberRepository) {
        this.userRepository = userRepository;
        this.workspaceRepository = workspaceRepository;
        this.workspaceRoleRepository = workspaceRoleRepository;
        this.workspaceMemberRepository = workspaceMemberRepository;
    }

    @Transactional
    public UUID create(UUID ownerId, CreateWorkspaceRequest request) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));

        Workspace workspace = new Workspace();
        workspace.setOwner(owner);
        workspace.setName(request.name());
        workspace.setDescription(request.description());
        workspaceRepository.save(workspace);

        WorkspaceRole ownerRole = new WorkspaceRole();
        ownerRole.setWorkspace(workspace);
        ownerRole.setName(OWNER_ROLE_NAME);
        workspaceRoleRepository.save(ownerRole);

        WorkspaceMember ownerMember = new WorkspaceMember();
        ownerMember.setUser(owner);
        ownerMember.setWorkspace(workspace);
        ownerMember.setRole(ownerRole);
        workspaceMemberRepository.save(ownerMember);

        return workspace.getId();
    }
}
