package com.vaulty.api.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vaulty.api.dto.auth.ResetPasswordRequest;
import com.vaulty.api.entity.PasswordResetToken;
import com.vaulty.api.entity.User;
import com.vaulty.api.exception.InvalidCredentialsException;
import com.vaulty.api.repository.PasswordResetTokenRepository;
import com.vaulty.api.repository.RefreshTokenRepository;
import com.vaulty.api.repository.UserInviteRepository;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceResetExpirationTest {

    @Test
    void tokenExpiringAtCurrentInstantIsRejected() {
        Instant now = Instant.parse("2030-01-01T12:00:00Z");
        User user = new User();
        user.setId(UUID.randomUUID());
        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setToken("at-the-boundary");
        resetToken.setUser(user);
        resetToken.setExpiresAt(OffsetDateTime.ofInstant(now, ZoneOffset.UTC));

        PasswordResetTokenRepository resetTokens = mock(PasswordResetTokenRepository.class);
        CredentialService credentials = mock(CredentialService.class);
        when(resetTokens.findByToken(resetToken.getToken())).thenReturn(Optional.of(resetToken));
        AuthService service = new AuthService(
                mock(UserRepository.class),
                mock(RefreshTokenRepository.class),
                mock(UserInviteRepository.class),
                resetTokens,
                mock(PasswordEncoder.class),
                mock(JwtService.class),
                mock(EmailOutboxService.class),
                credentials,
                mock(WorkspaceService.class),
                mock(WorkspaceMemberRepository.class),
                mock(WorkspaceContentAuthorization.class),
                mock(ActivityLogService.class),
                Clock.fixed(now, ZoneOffset.UTC),
                604_800_000,
                3_600_000);

        assertThatThrownBy(() -> service.resetPassword(
                        new ResetPasswordRequest(resetToken.getToken(), "new-password", "new-password")))
                .isInstanceOf(InvalidCredentialsException.class);
        verify(credentials, never()).updatePassword(any(UUID.class), anyString());
    }
}
