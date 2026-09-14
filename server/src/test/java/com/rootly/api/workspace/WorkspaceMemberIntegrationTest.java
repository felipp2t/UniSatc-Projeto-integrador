package com.rootly.api.workspace;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rootly.api.PostgresIntegrationTest;
import com.rootly.api.dto.workspace.CreateWorkspaceRequest;
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
import com.rootly.api.service.WorkspaceService;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class WorkspaceMemberIntegrationTest extends PostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private WorkspaceRepository workspaceRepository;
    @Autowired private WorkspaceRoleRepository workspaceRoleRepository;
    @Autowired private WorkspaceMemberRepository workspaceMemberRepository;
    @Autowired private EmailOutboxRepository emailOutboxRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private UserInviteRepository userInviteRepository;
    @Autowired private WorkspaceService workspaceService;
    @Autowired private WorkspaceMapper workspaceMapper;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        cleanDatabase();
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
    }

    @Test
    void ownerListsMembersWithUserAndRoleData() throws Exception {
        User owner = createUser("Proprietário");
        WorkspaceResponse workspace = createWorkspace(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/members", workspace.id()).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").isString())
                .andExpect(jsonPath("$[0].userId").value(owner.getId().toString()))
                .andExpect(jsonPath("$[0].name").value("Proprietário"))
                .andExpect(jsonPath("$[0].email").value(owner.getEmail()))
                .andExpect(jsonPath("$[0].roleId").isString())
                .andExpect(jsonPath("$[0].roleName").value("Owner"));
    }

    @Test
    void nonOwnerMemberCanListWorkspaceMembers() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        WorkspaceResponse workspace = createWorkspace(owner);
        addMember(member, workspace.id());

        mockMvc.perform(get("/workspaces/{workspaceId}/members", workspace.id()).cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void userWithoutMembershipCannotListWorkspaceMembers() throws Exception {
        User owner = createUser("Proprietário");
        User unrelatedUser = createUser("Usuário externo");
        WorkspaceResponse workspace = createWorkspace(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/members", workspace.id())
                        .cookie(authCookie(unrelatedUser)))
                .andExpect(status().isNotFound());
    }

    @Test
    void unauthenticatedUserCannotListWorkspaceMembers() throws Exception {
        mockMvc.perform(get("/workspaces/{workspaceId}/members", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    private User createUser(String name) {
        User user = new User();
        user.setName(name);
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("password123"));
        return userRepository.save(user);
    }

    private WorkspaceResponse createWorkspace(User owner) {
        return workspaceService.create(owner.getId(), new CreateWorkspaceRequest("Workspace", null));
    }

    private void addMember(User user, UUID workspaceId) {
        Workspace workspace = workspaceRepository.findById(workspaceId).orElseThrow();
        WorkspaceRole role = workspaceRoleRepository.findAll().stream()
                .filter(candidate -> candidate.getWorkspace().getId().equals(workspaceId))
                .findFirst()
                .orElseThrow();
        WorkspaceMember member = workspaceMapper.toMember(user, workspace, role);
        workspaceMemberRepository.save(member);
    }

    private Cookie authCookie(User user) {
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
