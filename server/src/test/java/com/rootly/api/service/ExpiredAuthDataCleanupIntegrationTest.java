package com.rootly.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.rootly.api.PostgresIntegrationTest;
import com.rootly.api.dto.auth.RegisterRequest;
import com.rootly.api.dto.auth.ResetPasswordRequest;
import com.rootly.api.entity.PasswordResetToken;
import com.rootly.api.entity.RefreshToken;
import com.rootly.api.entity.User;
import com.rootly.api.entity.UserInvite;
import com.rootly.api.exception.InvalidCredentialsException;
import com.rootly.api.exception.InvalidInviteException;
import com.rootly.api.repository.EmailOutboxRepository;
import com.rootly.api.repository.PasswordResetTokenRepository;
import com.rootly.api.repository.RefreshTokenRepository;
import com.rootly.api.repository.UserInviteRepository;
import com.rootly.api.repository.UserRepository;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

class ExpiredAuthDataCleanupIntegrationTest extends PostgresIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private UserInviteRepository userInviteRepository;
    @Autowired private EmailOutboxRepository emailOutboxRepository;
    @Autowired private ExpiredAuthDataCleanupService cleanupService;
    @Autowired private AuthService authService;
    @Autowired private PasswordEncoder passwordEncoder;

    @BeforeEach
    void cleanDatabase() {
        emailOutboxRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userInviteRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void rejectionDoesNotPretendToDeleteAndMaintenanceRemovesOnlyExpiredRecords() {
        User user = createUser();
        PasswordResetToken expiredReset = reset(user, "expired", OffsetDateTime.now().minusMinutes(1));
        reset(user, "valid", OffsetDateTime.now().plusHours(1));
        RefreshToken expiredRefresh = refresh(user, "expired-refresh", OffsetDateTime.now().minusMinutes(1));
        refresh(user, "valid-refresh", OffsetDateTime.now().plusHours(1));
        UserInvite expiredInvite = invite(user, "expired@example.com", OffsetDateTime.now().minusMinutes(1));
        invite(user, "valid@example.com", OffsetDateTime.now().plusHours(1));

        assertThatThrownBy(() -> authService.resetPassword(
                        new ResetPasswordRequest(expiredReset.getToken(), "new-password", "new-password")))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThat(passwordResetTokenRepository.findByToken("expired")).isPresent();

        assertThatThrownBy(() -> authService.refreshToken(expiredRefresh.getToken()))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThat(refreshTokenRepository.findByToken("expired-refresh")).isPresent();

        assertThatThrownBy(() -> authService.register(new RegisterRequest(
                        expiredInvite.getEmail(), expiredInvite.getToken(), "New User", "password123", "password123")))
                .isInstanceOf(InvalidInviteException.class);
        assertThat(userInviteRepository.findByEmailAndToken(expiredInvite.getEmail(), expiredInvite.getToken()))
                .isPresent();

        cleanupService.cleanup();

        assertThat(passwordResetTokenRepository.findAll()).extracting(PasswordResetToken::getToken).containsExactly("valid");
        assertThat(refreshTokenRepository.findAll()).extracting(RefreshToken::getToken).containsExactly("valid-refresh");
        assertThat(userInviteRepository.findAll()).extracting(UserInvite::getEmail).containsExactly("valid@example.com");
    }

    private User createUser() {
        User user = new User();
        user.setName("Test User");
        user.setEmail("user@example.com");
        user.setPasswordHash(passwordEncoder.encode("password123"));
        return userRepository.save(user);
    }

    private PasswordResetToken reset(User user, String token, OffsetDateTime expiresAt) {
        PasswordResetToken value = new PasswordResetToken();
        value.setToken(token);
        value.setUser(user);
        value.setExpiresAt(expiresAt);
        return passwordResetTokenRepository.save(value);
    }

    private RefreshToken refresh(User user, String token, OffsetDateTime expiresAt) {
        RefreshToken value = new RefreshToken();
        value.setToken(token);
        value.setUser(user);
        value.setExpiresAt(expiresAt);
        return refreshTokenRepository.save(value);
    }

    private UserInvite invite(User user, String email, OffsetDateTime expiresAt) {
        UserInvite value = new UserInvite();
        value.setEmail(email);
        value.setToken(UUID.randomUUID().toString());
        value.setInvitedBy(user);
        value.setExpiresAt(expiresAt);
        return userInviteRepository.save(value);
    }
}
