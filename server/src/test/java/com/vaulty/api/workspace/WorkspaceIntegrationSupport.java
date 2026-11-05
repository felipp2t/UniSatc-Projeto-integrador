package com.vaulty.api.workspace;

import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.enums.GlobalRole;
import com.vaulty.api.mapper.WorkspaceMapper;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import com.vaulty.api.repository.RolePermissionRepository;
import com.vaulty.api.service.JwtService;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@AutoConfigureMockMvc
@Transactional
abstract class WorkspaceIntegrationSupport extends PostgresIntegrationTest {

    @Autowired protected MockMvc mockMvc;
    @Autowired protected UserRepository userRepository;
    @Autowired protected WorkspaceRepository workspaceRepository;
    @Autowired protected WorkspaceRoleRepository workspaceRoleRepository;
    @Autowired protected WorkspaceMemberRepository workspaceMemberRepository;
    @Autowired protected RolePermissionRepository rolePermissionRepository;
    @Autowired protected WorkspaceMapper workspaceMapper;
    @Autowired protected JwtService jwtService;
    @Autowired protected PasswordEncoder passwordEncoder;

    protected User createUser() {
        return createUser("Test User");
    }

    protected User createUser(String name) {
        User user = new User();
        user.setName(name);
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("password123"));
        return userRepository.saveAndFlush(user);
    }

    protected WorkspaceResponse configureWorkspace(User owner) {
        return configureWorkspace(owner, "Workspace");
    }

    protected WorkspaceResponse configureWorkspace(User owner, String name) {
        Workspace workspace = workspaceRepository.findSingleton().orElseThrow();
        workspace.setOwner(owner);
        workspace.setName(name);
        workspaceRepository.saveAndFlush(workspace);
        workspaceMemberRepository.deleteAll();

        workspaceMemberRepository.save(workspaceMapper.toMember(owner, workspace));

        return workspaceMapper.toResponse(workspace);
    }

    protected void addMember(User user, UUID workspaceId) {
        Workspace workspace = workspaceRepository.findById(workspaceId).orElseThrow();
        WorkspaceMember member = workspaceMapper.toMember(user, workspace);
        workspaceMemberRepository.save(member);
    }

    protected void assignRole(User user, UUID workspaceId, String roleName) {
        WorkspaceMember membership = workspaceMemberRepository
                .findByWorkspaceIdAndUserId(workspaceId, user.getId()).orElseThrow();
        membership.setRole(null);
        membership.setTeam(null);
        membership.setGlobalRole(switch (roleName) {
            case "Admin" -> GlobalRole.ADMIN;
            case "Maintainer" -> GlobalRole.MAINTAINER;
            case WorkspaceRole.OWNER_ROLE_NAME -> {
                Workspace workspace = workspaceRepository.findById(workspaceId).orElseThrow();
                workspace.setOwner(user);
                workspaceRepository.saveAndFlush(workspace);
                yield null;
            }
            default -> null;
        });
        workspaceMemberRepository.saveAndFlush(membership);
    }

    protected Cookie authCookie(User user) {
        WorkspaceMember membership = workspaceMemberRepository.findByUserId(user.getId()).orElseThrow();
        return new Cookie("accessToken", jwtService.generateAccessToken(
                user.getId(), membership.getId(), null));
    }

    protected Cookie authCookieWithoutMembership(User user) {
        return new Cookie("accessToken", jwtService.generateAccessToken(user.getId(), null));
    }
}
