package com.rootly.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rootly.api.PostgresIntegrationTest;
import com.rootly.api.dto.workspace.CreateWorkspaceRequest;
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
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

@AutoConfigureMockMvc
class WorkspaceCreationIntegrationTest extends PostgresIntegrationTest {

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
    @Autowired private TransactionTemplate transactionTemplate;

    @BeforeEach
    void setUp() {
        cleanDatabase();
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
    }

    @Test
    void createsWorkspaceOwnerRoleAndOwnerMembership() throws Exception {
        User owner = createUser();

        mockMvc.perform(post("/workspaces")
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "  Meu Workspace  ",
                                  "description": "  Documentação da equipe  "
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.ownerId").value(owner.getId().toString()))
                .andExpect(jsonPath("$.name").value("Meu Workspace"))
                .andExpect(jsonPath("$.description").value("Documentação da equipe"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        Workspace workspace = workspaceRepository.findAll().get(0);
        WorkspaceRole role = workspaceRoleRepository.findAll().get(0);
        WorkspaceMember member = workspaceMemberRepository.findAll().get(0);

        assertThat(workspace.getName()).isEqualTo("Meu Workspace");
        assertThat(workspace.getDescription()).isEqualTo("Documentação da equipe");
        assertThat(workspace.getOwner().getId()).isEqualTo(owner.getId());
        assertThat(role.getName()).isEqualTo("Owner");
        assertThat(role.getWorkspace().getId()).isEqualTo(workspace.getId());
        assertThat(member.getUser().getId()).isEqualTo(owner.getId());
        assertThat(member.getWorkspace().getId()).isEqualTo(workspace.getId());
        assertThat(member.getRole().getId()).isEqualTo(role.getId());
    }

    @Test
    void convertsBlankDescriptionToNull() {
        User owner = createUser();

        workspaceService.create(owner.getId(), new CreateWorkspaceRequest("Workspace", "   "));

        assertThat(workspaceRepository.findAll().get(0).getDescription()).isNull();
    }

    @Test
    void updatesOnlyEditableWorkspaceFields() {
        User owner = createUser();
        Workspace workspace = new Workspace();
        UUID workspaceId = UUID.randomUUID();
        workspace.setId(workspaceId);
        workspace.setOwner(owner);
        workspace.setName("Nome anterior");
        workspace.setDescription("Descrição anterior");

        workspaceMapper.update(new CreateWorkspaceRequest("Nome atualizado", "Nova descrição"), workspace);

        assertThat(workspace.getId()).isEqualTo(workspaceId);
        assertThat(workspace.getOwner()).isEqualTo(owner);
        assertThat(workspace.getName()).isEqualTo("Nome atualizado");
        assertThat(workspace.getDescription()).isEqualTo("Nova descrição");
    }

    @Test
    void rejectsInvalidNameWithoutPersistingAnything() throws Exception {
        User owner = createUser();

        mockMvc.perform(post("/workspaces")
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "name": "  a  " }
                                """))
                .andExpect(status().isBadRequest());

        assertWorkspaceTablesAreEmpty();
    }

    @Test
    void rejectsUnauthenticatedCreation() throws Exception {
        mockMvc.perform(post("/workspaces")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "name": "Workspace" }
                                """))
                .andExpect(status().isUnauthorized());

        assertWorkspaceTablesAreEmpty();
    }

    @Test
    void participatesInTheCallerTransactionSoTheAggregateRollsBackTogether() {
        User owner = createUser();

        transactionTemplate.executeWithoutResult(status -> {
            workspaceService.create(owner.getId(), new CreateWorkspaceRequest("Workspace", null));
            status.setRollbackOnly();
        });

        assertWorkspaceTablesAreEmpty();
    }

    private Cookie authCookie(User user) {
        return new Cookie("accessToken", jwtService.generateAccessToken(user.getId()));
    }

    private User createUser() {
        User user = new User();
        user.setName("Test User");
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("password123"));
        return userRepository.save(user);
    }

    private void assertWorkspaceTablesAreEmpty() {
        assertThat(workspaceMemberRepository.findAll()).isEmpty();
        assertThat(workspaceRoleRepository.findAll()).isEmpty();
        assertThat(workspaceRepository.findAll()).isEmpty();
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
