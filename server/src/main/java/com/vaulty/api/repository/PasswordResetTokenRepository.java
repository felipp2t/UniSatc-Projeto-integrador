package com.vaulty.api.repository;

import com.vaulty.api.entity.PasswordResetToken;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {

    Optional<PasswordResetToken> findByToken(String token);

    void deleteAllByUserId(UUID userId);

    long deleteByExpiresAtLessThanEqual(OffsetDateTime now);
}
