package com.vaulty.api.invite;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.UserInvite;
import com.vaulty.api.entity.UserInviteStatus;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.repository.UserInviteRepository;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import com.vaulty.api.service.JwtService;
import com.vaulty.api.service.WorkspaceService;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
@Import(InviteAndRegisterIntegrationTest.ClockConfiguration.class)
class InviteAndRegisterIntegrationTest extends PostgresIntegrationTest {

    private static final String ADMIN_EMAIL = "admin@gmail.com";

    @Autowired private Clock clock;
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
                .andExpect(jsonPath("$.remainingSeconds").value(7 * 24 * 60 * 60));
    }

    @Test
    void inviteeCanDeclineAValidInviteWithoutAuthenticationAndItCannotBeAccepted() throws Exception {
        UserInvite invite = createInvite("recusar@example.com");
        String body = """
                { "email": "%s", "token": "%s" }
                """.formatted(invite.getEmail(), invite.getToken());

        mockMvc.perform(post("/invites/decline")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Cache-Control", "no-store"));

        assertThat(userInviteRepository.findByEmailAndToken(invite.getEmail(), invite.getToken())
                        .orElseThrow()
                        .getStatus())
                .isEqualTo(UserInviteStatus.DECLINED);

        mockMvc.perform(post("/invites/validate")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Convite indisponível"));

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s", "token": "%s", "name": "Novo Colaborador",
                                  "password": "password123", "confirmPassword": "password123"
                                }
                                """.formatted(invite.getEmail(), invite.getToken())))
                .andExpect(status().isNotFound());

        assertThat(userRepository.findByEmail(invite.getEmail())).isEmpty();
    }

    @Test
    void declineReturnsTheSameUnavailableResponseForExpiredAndUnknownInvites() throws Exception {
        UserInvite expiredInvite = createInvite(
                "expirado-para-recusar@example.com", OffsetDateTime.now(clock).minusSeconds(1));
        RequestPostProcessor remoteAddress = uniqueRemoteAddress();

        mockMvc.perform(post("/invites/decline")
                        .with(remoteAddress)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "%s", "token": "%s" }
                                """.formatted(expiredInvite.getEmail(), expiredInvite.getToken())))
                .andExpect(status().isNotFound())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.message").value("Convite indisponível"));

        mockMvc.perform(post("/invites/decline")
                        .with(remoteAddress)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "%s", "token": "inexistente" }
                                """.formatted(expiredInvite.getEmail())))
                .andExpect(status().isNotFound())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.message").value("Convite indisponível"));

        assertThat(userInviteRepository.findByEmailAndToken(expiredInvite.getEmail(), expiredInvite.getToken())
                        .orElseThrow()
                        .getStatus())
                .isEqualTo(UserInviteStatus.PENDING);
    }

    @Test
    void declineInviteIsRateLimitedSeparatelyByPath() throws Exception {
        String body = """
                { "email": "unknown@example.com", "token": "unknown" }
                """;
        RequestPostProcessor remoteAddress = uniqueRemoteAddress();

        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/invites/decline")
                            .with(remoteAddress)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isNotFound());
        }

        mockMvc.perform(post("/invites/decline")
                        .with(remoteAddress)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void ownerCanResendAnInviteAfterItWasDeclined() throws Exception {
        UserInvite declinedInvite = createInvite("reenviar@example.com");
        declinedInvite.setStatus(UserInviteStatus.DECLINED);
        userInviteRepository.save(declinedInvite);

        mockMvc.perform(post("/invites")
                        .cookie(authCookie(admin()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "reenviar@example.com" }
                                """))
                .andExpect(status().isCreated());

        assertThat(userInviteRepository.findAll().stream()
                        .filter(invite -> invite.getEmail().equals("reenviar@example.com")))
                .singleElement()
                .satisfies(invite -> assertThat(invite.getStatus()).isEqualTo(UserInviteStatus.PENDING));
    }

    @Test
    void declineInviteIsDocumentedInOpenApi() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/invites/decline'].post.responses['204']").exists())
                .andExpect(jsonPath("$.paths['/invites/decline'].post.requestBody").exists());
    }

    @Test
    void declineRejectsInvalidBodyWithoutCachingTheResponse() throws Exception {
        mockMvc.perform(post("/invites/decline")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void invalidAndExpiredInvitesHaveTheSameUnavailableResponse() throws Exception {
        UserInvite expiredInvite = createInvite(
                "expirado@example.com", OffsetDateTime.now(clock).minusSeconds(1));
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

    @Test
    void invalidBodyIsNotCached() throws Exception {
        mockMvc.perform(post("/invites/validate")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "no-store"));

        mockMvc.perform(post("/invites/validate")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void emailWithAnAccountHasTheSameUnavailableResponse() throws Exception {
        UserInvite invite = createInvite(ADMIN_EMAIL);

        mockMvc.perform(post("/invites/validate")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "%s", "token": "%s" }
                                """.formatted(invite.getEmail(), invite.getToken())))
                .andExpect(status().isNotFound())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.message").value("Convite indisponível"));
    }

    @ParameterizedTest
    @ValueSource(longs = {-1, 0, 1})
    void validationAndRegistrationAgreeAtExpiration(long remainingMicros) throws Exception {
        UserInvite invite = createInvite(
                "boundary@example.com", OffsetDateTime.now(clock).plusNanos(remainingMicros * 1000));
        boolean valid = remainingMicros > 0;

        var validation = mockMvc.perform(post("/invites/validate")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "%s", "token": "%s" }
                                """.formatted(invite.getEmail(), invite.getToken())))
                .andExpect(status().is(valid ? 200 : 404))
                .andExpect(header().string("Cache-Control", "no-store"));
        if (valid) {
            validation.andExpect(jsonPath("$.remainingSeconds").value(1));
        } else {
            validation.andExpect(jsonPath("$.message").value("Convite indisponível"));
        }

        var registration = mockMvc.perform(post("/auth/register")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s", "token": "%s", "name": "Boundary User",
                                  "password": "password123", "confirmPassword": "password123"
                                }
                                """.formatted(invite.getEmail(), invite.getToken())))
                .andExpect(status().is(valid ? 200 : 409));
        if (!valid) {
            registration.andExpect(jsonPath("$.message").value("Convite expirado"));
        }
        assertThat(userRepository.findByEmail(invite.getEmail()).isPresent()).isEqualTo(valid);
        assertThat(userInviteRepository.findByEmailAndToken(invite.getEmail(), invite.getToken()).isPresent())
                .isEqualTo(!valid);
    }

    @Test
    void otherEndpointsKeepTheirDefaultCachePolicy() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate"));
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class ClockConfiguration {
        @Bean
        @Primary
        Clock inviteTestClock() {
            return Clock.fixed(Instant.parse("2030-01-01T00:00:00Z"), ZoneOffset.UTC);
        }
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
        return createInvite(email, OffsetDateTime.now(clock).plusDays(7));
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
        var membershipId = workspaceMemberRepository.findByUserId(user.getId()).orElseThrow().getId();
        return new Cookie("accessToken", jwtService.generateAccessToken(user.getId(), membershipId, role));
    }
}
