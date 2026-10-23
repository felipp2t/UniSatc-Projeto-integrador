package com.vaulty.api.repository;

import com.vaulty.api.entity.UserInvite;
import com.vaulty.api.entity.UserInviteStatus;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserInviteRepository extends JpaRepository<UserInvite, UUID> {

    Optional<UserInvite> findByEmailAndToken(String email, String token);

    Optional<UserInvite> findByEmailAndTokenAndStatus(String email, String token, UserInviteStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select invite from UserInvite invite
            where invite.email = :email and invite.token = :token and invite.status = :status
            """)
    Optional<UserInvite> findByEmailAndTokenAndStatusForUpdate(
            @Param("email") String email,
            @Param("token") String token,
            @Param("status") UserInviteStatus status);

    void deleteAllByEmail(String email);

    long deleteByExpiresAtLessThanEqual(OffsetDateTime now);
}
