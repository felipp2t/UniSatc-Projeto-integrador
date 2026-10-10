package com.rootly.api.workspace;

import com.rootly.api.PostgresIntegrationTest;
import com.rootly.api.dto.workspace.WorkspaceResponse;
import com.rootly.api.entity.User;
import com.rootly.api.entity.Workspace;
import com.rootly.api.entity.WorkspaceMember;
import com.rootly.api.entity.WorkspaceRole;
import com.rootly.api.mapper.WorkspaceMapper;
import com.rootly.api.repository.EmailOutboxRepository;
import com.rootly.api.repository.PasswordResetTokenRepository;
import com.rootly.api.repository.RefreshTokenRepository;
import com.rootly.api.repository.UserInviteRepository;
import com.rootly.api.repository.UserRepository;
import com.rootly.api.repository.WorkspaceMemberRepository;
import com.rootly.api.repository.WorkspaceRepository;
import com.rootly.api.repository.WorkspaceRoleRepository;
import com.rootly.api.service.JwtService;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

@AutoConfigureMockMvc
abstract class WorkspaceIntegrationSupport extends PostgresIntegrationTest {

    @Autowired protected MockMvc mockMvc;
    @Autowired protected UserRepository userRepository;
    @Autowired protected WorkspaceRepository workspaceRepository;
    @Autowired protected WorkspaceRoleRepository workspaceRoleRepository;
    @Autowired protected WorkspaceMemberRepository workspaceMemberRepository;
    @Autowired protected WorkspaceMapper workspaceMapper;
    @Autowired protected JwtService jwtService;
    @Autowired protected PasswordEncoder passwordEncoder;
    @Autowired protected TransactionTemplate transactionTemplate;
    @Autowired protected JdbcTemplate jdbcTemplate;

    @Autowired private EmailOutboxRepository emailOutboxRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private UserInviteRepository userInviteRepository;

    @BeforeEach
    void setUpWorkspaceFixture() {
        cleanDatabase();
    }

    @AfterEach
    void tearDownWorkspaceFixture() {
        cleanDatabase();
    }

    protected User createUser() {
        return createUser("Test User");
    }

    protected User createUser(String name) {
        User user = new User();
        user.setName(name);
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("password123"));
        return userRepository.save(user);
    }

    protected WorkspaceResponse createWorkspace(User owner) {
        return createWorkspace(owner, "Workspace");
    }

    protected WorkspaceResponse createWorkspace(User owner, String name) {
        Workspace workspace = new Workspace();
        workspace.setOwner(owner);
        workspace.setName(name);
        workspaceRepository.saveAndFlush(workspace);

        WorkspaceRole ownerRole = workspaceRoleRepository.save(WorkspaceRole.owner(workspace));
        workspaceMemberRepository.save(workspaceMapper.toMember(owner, workspace, ownerRole));

        return workspaceMapper.toResponse(workspace);
    }

    protected void addMember(User user, UUID workspaceId) {
        Workspace workspace = workspaceRepository.findById(workspaceId).orElseThrow();
        WorkspaceRole role = workspaceRoleRepository.findAll().stream()
                .filter(candidate -> candidate.getWorkspace().getId().equals(workspaceId))
                .findFirst()
                .orElseThrow();

        WorkspaceMember member = workspaceMapper.toMember(user, workspace, role);
        workspaceMemberRepository.save(member);
    }

    protected Cookie authCookie(User user) {
        return new Cookie("accessToken", jwtService.generateAccessToken(user.getId()));
    }

    private void cleanDatabase() {
        workspaceMemberRepository.deleteAll();
        workspaceRoleRepository.deleteAll();
        workspaceRepository.deleteAll();
        emailOutboxRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userInviteRepository.deleteAll();
        userRepository.deleteAll();
    }
}
