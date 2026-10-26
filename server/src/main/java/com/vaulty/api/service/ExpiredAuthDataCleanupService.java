package com.vaulty.api.service;

import com.vaulty.api.repository.PasswordResetTokenRepository;
import com.vaulty.api.repository.RefreshTokenRepository;
import com.vaulty.api.repository.UserInviteRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExpiredAuthDataCleanupService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final UserInviteRepository userInviteRepository;
    private final Clock clock;

    public ExpiredAuthDataCleanupService(
            RefreshTokenRepository refreshTokenRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            UserInviteRepository userInviteRepository,
            Clock clock) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.userInviteRepository = userInviteRepository;
        this.clock = clock;
    }

    @Transactional
    public void cleanup() {
        OffsetDateTime now = OffsetDateTime.now(clock);
        refreshTokenRepository.deleteByExpiresAtLessThanEqual(now);
        passwordResetTokenRepository.deleteByExpiresAtLessThanEqual(now);
        userInviteRepository.deleteByExpiresAtLessThanEqual(now);
    }
}
