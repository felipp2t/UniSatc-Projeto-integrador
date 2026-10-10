package com.rootly.api.invite;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rootly.api.PostgresIntegrationTest;
import com.rootly.api.entity.User;
import com.rootly.api.entity.UserInvite;
import com.rootly.api.entity.Workspace;
import com.rootly.api.entity.WorkspaceMember;
import com.rootly.api.entity.WorkspaceRole;
import com.rootly.api.repository.UserInviteRepository;
import com.rootly.api.repository.UserRepository;
import com.rootly.api.repository.WorkspaceMemberRepository;
import com.rootly.api.repository.WorkspaceRepository;
import com.rootly.api.repository.WorkspaceRoleRepository;
import com.rootly.api.service.JwtService;
import jakarta.servlet.http.Cookie;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class InviteAndRegisterIntegrationTest extends PostgresIntegrationTest {

    private static final String ADMIN_EMAIL = "admin@gmail.com";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private UserInviteRepository userInviteRepository;
    @Autowired private WorkspaceRepository workspaceRepository;
    @Autowired private WorkspaceRoleRepository workspaceRoleRepository;
    @Autowired private WorkspaceMemberRepository workspaceMemberRepository;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;

    @AfterEach
    void cleanUp() {
        userInviteRepository.deleteAll();
        userRepository.deleteAllByEmailNot(ADMIN_EMAIL);
    }

    @Test
    void ownerCanInviteANewEmail() throws Exception {
        mockMvc.perform(post("/invites")
                        .cookie(authCookie(admin()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "convidado@example.com" }
                                """))
                .andExpect(status().isCreated());

        assertThat(userInviteRepository.findAll())
                .anyMatch(invite -> invite.getEmail().equals("convidado@example.com"));
    }

    @Test
    void nonOwnerMemberCannotInviteAnyone() throws Exception {
        User member = createMember();

        mockMvc.perform(post("/invites")
                        .cookie(authCookie(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "convidado@example.com" }
                                """))
                .andExpect(status().isForbidden());

        assertThat(userInviteRepository.findAll()).isEmpty();
    }

    @Test
    void acceptingAnInviteLinksTheNewAccountToTheWorkspaceWithTheMemberRole() throws Exception {
        UserInvite invite = createInvite("novo@example.com");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "novo@example.com",
                                  "token": "%s",
                                  "name": "Novo Colaborador",
                                  "password": "password123",
                                  "confirmPassword": "password123"
                                }
                                """.formatted(invite.getToken())))
                .andExpect(status().isOk());

        User createdUser = userRepository.findByEmail("novo@example.com").orElseThrow();
        WorkspaceMember membership = workspaceMemberRepository.findByUserId(createdUser.getId()).orElseThrow();

        assertThat(membership.getRole().getName()).isEqualTo(WorkspaceRole.MEMBER_ROLE_NAME);
        assertThat(membership.getWorkspace().getId()).isEqualTo(workspaceRepository.findSingleton().orElseThrow().getId());
    }

    private User admin() {
        return userRepository.findByEmail(ADMIN_EMAIL).orElseThrow();
    }

    private User createMember() {
        User user = new User();
        user.setName("Membro de Teste");
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("password123"));
        userRepository.save(user);

        Workspace workspace = workspaceRepository.findSingleton().orElseThrow();
        WorkspaceRole memberRole = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspace.getId(), WorkspaceRole.MEMBER_ROLE_NAME)
                .orElseThrow();

        WorkspaceMember membership = new WorkspaceMember();
        membership.setUser(user);
        membership.setWorkspace(workspace);
        membership.setRole(memberRole);
        workspaceMemberRepository.save(membership);

        return user;
    }

    private UserInvite createInvite(String email) {
        UserInvite invite = new UserInvite();
        invite.setEmail(email);
        invite.setToken(UUID.randomUUID().toString());
        invite.setInvitedBy(admin());
        invite.setExpiresAt(OffsetDateTime.now().plusDays(7));
        return userInviteRepository.save(invite);
    }

    private Cookie authCookie(User user) {
        return new Cookie("accessToken", jwtService.generateAccessToken(user.getId()));
    }
}
