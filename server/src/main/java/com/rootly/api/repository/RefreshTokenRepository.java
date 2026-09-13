package com.rootly.api.repository;

import com.rootly.api.entity.RefreshToken;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByToken(String token);

    void deleteAllByUserId(UUID userId);

    long deleteByExpiresAtLessThanEqual(OffsetDateTime now);
}
