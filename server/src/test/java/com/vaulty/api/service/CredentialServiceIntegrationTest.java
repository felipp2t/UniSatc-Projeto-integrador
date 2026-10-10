package com.vaulty.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.dto.auth.ResetPasswordRequest;
import com.vaulty.api.dto.user.ChangePasswordRequest;
import com.vaulty.api.entity.PasswordResetToken;
import com.vaulty.api.entity.RefreshToken;
import com.vaulty.api.entity.User;
import com.vaulty.api.exception.InvalidCredentialsException;
import com.vaulty.api.repository.EmailOutboxRepository;
import com.vaulty.api.repository.PasswordResetTokenRepository;
import com.vaulty.api.repository.RefreshTokenRepository;
import com.vaulty.api.repository.UserInviteRepository;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.service.JwtService;
import jakarta.servlet.http.Cookie;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class CredentialServiceIntegrationTest extends PostgresIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private UserInviteRepository userInviteRepository;
    @Autowired private EmailOutboxRepository emailOutboxRepository;
    @Autowired private UserService userService;
    @Autowired private AuthService authService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private MockMvc mockMvc;

    @BeforeEach
    void cleanDatabase() {
        emailOutboxRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userInviteRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void authenticatedChangeInvalidatesRefreshAndPendingRecoveryTokens() {
        User user = createUser("old-password");
        PasswordResetToken reset = createResetToken(user, "old-reset-token", OffsetDateTime.now().plusHours(1));
        createRefreshToken(user, "refresh-token", OffsetDateTime.now().plusHours(1));

        userService.changePassword(
                user.getId(), new ChangePasswordRequest("old-password", "new-password", "new-password"));

        assertThat(refreshTokenRepository.findAll()).isEmpty();
        assertThat(passwordResetTokenRepository.findAll()).isEmpty();
        assertThat(passwordEncoder.matches(
                        "new-password", userRepository.findById(user.getId()).orElseThrow().getPasswordHash()))
                .isTrue();
        assertThatThrownBy(() -> authService.resetPassword(
                        new ResetPasswordRequest(reset.getToken(), "another-password", "another-password")))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void wrongCurrentPasswordReturnsBadRequestWithoutChangingCredentials() throws Exception {
        User user = createUser("old-password");
        createResetToken(user, "pending-reset-token", OffsetDateTime.now().plusHours(1));
        createRefreshToken(user, "active-refresh-token", OffsetDateTime.now().plusHours(1));

        mockMvc.perform(patch("/me/password")
                        .cookie(new Cookie("accessToken", jwtService.generateAccessToken(user.getId())))
                        .contentType("application/json")
                        .content("""
                                {"currentPassword":"wrong-password","newPassword":"new-password","confirmPassword":"new-password"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Senha atual incorreta"))
                .andExpect(jsonPath("$.path").value("/me/password"));

        String passwordHash = userRepository.findById(user.getId()).orElseThrow().getPasswordHash();
        assertThat(passwordEncoder.matches("old-password", passwordHash)).isTrue();
        assertThat(passwordEncoder.matches("new-password", passwordHash)).isFalse();
        assertThat(refreshTokenRepository.findAll())
                .extracting(RefreshToken::getToken)
                .containsExactly("active-refresh-token");
        assertThat(passwordResetTokenRepository.findAll())
                .extracting(PasswordResetToken::getToken)
                .containsExactly("pending-reset-token");
    }

    @Test
    void passwordResetInvalidatesEveryCredentialToken() {
        User user = createUser("old-password");
        PasswordResetToken reset = createResetToken(user, "valid-reset-token", OffsetDateTime.now().plusHours(1));
        createResetToken(user, "other-reset-token", OffsetDateTime.now().plusHours(1));
        createRefreshToken(user, "refresh-token", OffsetDateTime.now().plusHours(1));

        authService.resetPassword(new ResetPasswordRequest(reset.getToken(), "new-password", "new-password"));

        assertThat(refreshTokenRepository.findAll()).isEmpty();
        assertThat(passwordResetTokenRepository.findAll()).isEmpty();
        assertThat(passwordEncoder.matches(
                        "new-password", userRepository.findById(user.getId()).orElseThrow().getPasswordHash()))
                .isTrue();
    }

    private User createUser(String password) {
        User user = new User();
        user.setName("Test User");
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode(password));
        return userRepository.save(user);
    }

    private PasswordResetToken createResetToken(User user, String token, OffsetDateTime expiresAt) {
        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setToken(token);
        resetToken.setUser(user);
        resetToken.setExpiresAt(expiresAt);
        return passwordResetTokenRepository.save(resetToken);
    }

    private void createRefreshToken(User user, String token, OffsetDateTime expiresAt) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(token);
        refreshToken.setUser(user);
        refreshToken.setExpiresAt(expiresAt);
        refreshTokenRepository.save(refreshToken);
    }
}
