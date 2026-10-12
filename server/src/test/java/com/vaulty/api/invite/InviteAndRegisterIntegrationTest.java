package com.vaulty.api.invite;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.UserInvite;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.repository.UserInviteRepository;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import com.vaulty.api.service.JwtService;
import com.vaulty.api.service.WorkspaceService;
import jakarta.servlet.http.Cookie;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class InviteAndRegisterIntegrationTest extends PostgresIntegrationTest {

    private static final String ADMIN_EMAIL = "admin@gmail.com";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private UserInviteRepository userInviteRepository;
    @Autowired private WorkspaceRepository workspaceRepository;
    @Autowired private WorkspaceService workspaceService;
    @Autowired private WorkspaceMemberRepository workspaceMemberRepository;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;

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

    @Test
    void validatesAnInviteWithoutAuthenticationAndReturnsServerCalculatedTime() throws Exception {
        UserInvite invite = createInvite("validar@example.com");
        RequestPostProcessor remoteAddress = uniqueRemoteAddress();

        mockMvc.perform(post("/invites/validate")
                        .with(remoteAddress)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "validar@example.com", "token": "%s" }
                                """.formatted(invite.getToken())))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.email").value("validar@example.com"))
                .andExpect(jsonPath("$.remainingSeconds").isNumber());
    }

    @Test
    void invalidAndExpiredInvitesHaveTheSameUnavailableResponse() throws Exception {
        UserInvite expiredInvite = createInvite(
                "expirado@example.com", OffsetDateTime.now().minusSeconds(1));
        RequestPostProcessor remoteAddress = uniqueRemoteAddress();

        mockMvc.perform(post("/invites/validate")
                        .with(remoteAddress)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "expirado@example.com", "token": "%s" }
                                """.formatted(expiredInvite.getToken())))
                .andExpect(status().isNotFound())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.message").value("Convite indisponível"));

        mockMvc.perform(post("/invites/validate")
                        .with(remoteAddress)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "expirado@example.com", "token": "inexistente" }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.message").value("Convite indisponível"));
    }

    @Test
    void rateLimitsInviteValidationSeparatelyByPath() throws Exception {
        UserInvite invite = createInvite("limite@example.com");
        String requestBody = """
                { "email": "limite@example.com", "token": "%s" }
                """.formatted(invite.getToken());
        RequestPostProcessor remoteAddress = uniqueRemoteAddress();

        mockMvc.perform(post("/auth/register")
                        .with(remoteAddress)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/invites/validate")
                            .with(remoteAddress)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(requestBody))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(post("/invites/validate")
                        .with(remoteAddress)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    private User admin() {
        return userRepository.findByEmail(ADMIN_EMAIL).orElseThrow();
    }

    private RequestPostProcessor uniqueRemoteAddress() {
        String remoteAddress = UUID.randomUUID().toString();
        return request -> {
            request.setRemoteAddr(remoteAddress);
            return request;
        };
    }

    private User createMember() {
        User user = new User();
        user.setName("Membro de Teste");
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("password123"));
        userRepository.save(user);

        workspaceService.addAsMember(user);

        return user;
    }

    private UserInvite createInvite(String email) {
        return createInvite(email, OffsetDateTime.now().plusDays(7));
    }

    private UserInvite createInvite(String email, OffsetDateTime expiresAt) {
        UserInvite invite = new UserInvite();
        invite.setEmail(email);
        invite.setToken(UUID.randomUUID().toString());
        invite.setInvitedBy(admin());
        invite.setExpiresAt(expiresAt);
        return userInviteRepository.save(invite);
    }

    private Cookie authCookie(User user) {
        String role = workspaceService.getRoleName(user.getId());
        return new Cookie("accessToken", jwtService.generateAccessToken(user.getId(), role));
    }
}
