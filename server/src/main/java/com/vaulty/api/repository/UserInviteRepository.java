package com.vaulty.api.repository;

import com.vaulty.api.dto.invite.InviteResponse;
import com.vaulty.api.entity.UserInvite;
import com.vaulty.api.entity.UserInviteStatus;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.List;
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

    @Query("""
            select new com.vaulty.api.dto.invite.InviteResponse(
                invite.id, invite.email, inviter.id, inviter.name, invite.createdAt, invite.expiresAt)
            from UserInvite invite
            join invite.invitedBy inviter
            where invite.expiresAt > :now and invite.status = :status
              and not exists (
                  select registeredUser.id
                  from User registeredUser
                  where registeredUser.email = invite.email)
            order by invite.createdAt desc, invite.id desc
            """)
    List<InviteResponse> findPendingUsable(
            @Param("now") OffsetDateTime now,
            @Param("status") UserInviteStatus status);

    void deleteAllByEmail(String email);

    long deleteByExpiresAtLessThanEqual(OffsetDateTime now);
}
