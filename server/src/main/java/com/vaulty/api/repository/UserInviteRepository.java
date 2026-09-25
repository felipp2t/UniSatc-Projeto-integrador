package com.vaulty.api.repository;

import com.vaulty.api.entity.UserInvite;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserInviteRepository extends JpaRepository<UserInvite, UUID> {

    Optional<UserInvite> findByEmailAndToken(String email, String token);

    void deleteAllByEmail(String email);

    long deleteByExpiresAtLessThanEqual(OffsetDateTime now);
}
