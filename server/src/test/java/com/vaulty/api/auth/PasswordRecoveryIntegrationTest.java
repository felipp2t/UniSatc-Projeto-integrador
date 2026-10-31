package com.vaulty.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.entity.PasswordResetToken;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.repository.PasswordResetTokenRepository;
import com.vaulty.api.repository.RefreshTokenRepository;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@AutoConfigureMockMvc
class PasswordRecoveryIntegrationTest extends PostgresIntegrationTest {

    private static final String OLD_PASSWORD = "old-password";
    private static final String NEW_PASSWORD = "new-password";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordResetTokenRepository resetTokenRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private WorkspaceMemberRepository workspaceMemberRepository;
    @Autowired private WorkspaceRepository workspaceRepository;
    @Autowired private WorkspaceRoleRepository workspaceRoleRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @Test
    void requestHasSameNoContentResponseForKnownAndUnknownEmails() throws Exception {
        User user = createUser();

        var known = requestReset(user.getEmail());
        var unknown = requestReset("missing-" + UUID.randomUUID() + "@example.com");

        assertThat(known.getResponse().getStatus()).isEqualTo(unknown.getResponse().getStatus()).isEqualTo(204);
        assertThat(known.getResponse().getContentAsString()).isEqualTo(unknown.getResponse().getContentAsString()).isEmpty();
        assertThat(known.getResponse().getHeader("Set-Cookie")).isNull();
        assertThat(resetTokenRepository.findAll()).hasSize(1);
    }

    @Test
    void requestCreatesOneHourTokenAndLatestRequestInvalidatesPreviousLink() throws Exception {
        User user = createUser();

        requestReset(user.getEmail());
        PasswordResetToken first = resetTokenRepository.findAll().get(0);
        assertThat(first.getExpiresAt()).isBetween(
                first.getCreatedAt().plusHours(1).minusSeconds(1), first.getCreatedAt().plusHours(1).plusSeconds(1));

        requestReset(user.getEmail());
        PasswordResetToken latest = resetTokenRepository.findAll().get(0);
        assertThat(latest.getToken()).isNotEqualTo(first.getToken());
        assertThat(latest.getExpiresAt()).isAfter(first.getExpiresAt());
        resetPassword(first.getToken()).andExpect(status().isUnauthorized());

        resetPassword(latest.getToken()).andExpect(status().isNoContent()).andExpect(header().doesNotExist("Set-Cookie"));
        assertThat(passwordEncoder.matches(NEW_PASSWORD, userRepository.findById(user.getId()).orElseThrow().getPasswordHash()))
                .isTrue();
    }

    @Test
    void resetIsSingleUseAndRevokesRefreshAndOtherPendingLinksWithoutStartingSession() throws Exception {
        User user = createUser();
        ensureMembership(user);
        var login = mockMvc.perform(post("/auth/login")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + user.getEmail() + "\",\"password\":\"" + OLD_PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String refresh = refreshTokenRepository.findAll().get(0).getToken();
        assertThat(accessTokenMaxAge(login.getResponse().getHeaders("Set-Cookie"))).isLessThanOrEqualTo(900);
        PasswordResetToken token = createResetToken(user, "usable-reset-token", OffsetDateTime.now().plusHours(1));
        createResetToken(user, "other-pending-token", OffsetDateTime.now().plusHours(1));

        resetPassword(token.getToken()).andExpect(status().isNoContent()).andExpect(header().doesNotExist("Set-Cookie"));

        assertThat(resetTokenRepository.findAll()).isEmpty();
        assertThat(refreshTokenRepository.findAll()).isEmpty();
        mockMvc.perform(post("/auth/refresh").with(uniqueRemoteAddress())
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", refresh)))
                .andExpect(status().isUnauthorized());
        assertThat(passwordEncoder.matches(OLD_PASSWORD, userRepository.findById(user.getId()).orElseThrow().getPasswordHash()))
                .isFalse();
        assertThat(passwordEncoder.matches(NEW_PASSWORD, userRepository.findById(user.getId()).orElseThrow().getPasswordHash()))
                .isTrue();
        resetPassword(token.getToken()).andExpect(status().isUnauthorized());
    }

    @Test
    void invalidAndExpiredLinksDoNotChangePassword() throws Exception {
        User user = createUser();
        PasswordResetToken expired = createResetToken(user, "expired-reset-token", OffsetDateTime.now().minusSeconds(1));

        resetPassword("unknown-token").andExpect(status().isUnauthorized());
        resetPassword(expired.getToken()).andExpect(status().isUnauthorized());

        assertThat(passwordEncoder.matches(OLD_PASSWORD, userRepository.findById(user.getId()).orElseThrow().getPasswordHash()))
                .isTrue();
    }

    private org.springframework.test.web.servlet.MvcResult requestReset(String email) throws Exception {
        return mockMvc.perform(post("/auth/forgot-password")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\"}"))
                .andExpect(status().isNoContent())
                .andReturn();
    }

    private org.springframework.test.web.servlet.ResultActions resetPassword(String token) throws Exception {
        return mockMvc.perform(post("/auth/reset-password")
                .with(uniqueRemoteAddress())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"newPassword\":\"" + NEW_PASSWORD
                        + "\",\"confirmPassword\":\"" + NEW_PASSWORD + "\"}"));
    }

    private long accessTokenMaxAge(java.util.List<String> cookies) {
        return cookies.stream()
                .filter(cookie -> cookie.startsWith("accessToken="))
                .map(cookie -> cookie.replaceAll(".*Max-Age=(\\d+).*", "$1"))
                .mapToLong(Long::parseLong)
                .findFirst().orElseThrow();
    }

    private RequestPostProcessor uniqueRemoteAddress() {
        return request -> {
            request.setRemoteAddr(UUID.randomUUID().toString());
            return request;
        };
    }

    private User createUser() {
        User user = new User();
        user.setName("Recovery test");
        user.setEmail("recovery-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode(OLD_PASSWORD));
        return userRepository.saveAndFlush(user);
    }

    private PasswordResetToken createResetToken(User user, String value, OffsetDateTime expiresAt) {
        PasswordResetToken token = new PasswordResetToken();
        token.setToken(value);
        token.setUser(user);
        token.setExpiresAt(expiresAt);
        return resetTokenRepository.saveAndFlush(token);
    }

    private WorkspaceMember ensureMembership(User user) {
        return workspaceMemberRepository.findByUserId(user.getId()).orElseGet(() -> {
            var workspace = workspaceRepository.findSingleton().orElseThrow();
            var role = workspaceRoleRepository.findByWorkspaceIdAndName(
                    workspace.getId(), com.vaulty.api.entity.WorkspaceRole.MEMBER_ROLE_NAME).orElseThrow();
            var membership = new WorkspaceMember();
            membership.setUser(user);
            membership.setWorkspace(workspace);
            membership.setRole(role);
            return workspaceMemberRepository.saveAndFlush(membership);
        });
    }
}
