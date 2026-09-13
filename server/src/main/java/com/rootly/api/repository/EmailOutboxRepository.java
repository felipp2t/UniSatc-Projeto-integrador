package com.rootly.api.repository;

import com.rootly.api.entity.EmailOutbox;
import com.rootly.api.entity.EmailOutboxStatus;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmailOutboxRepository extends JpaRepository<EmailOutbox, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<EmailOutbox> findFirstByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(
            EmailOutboxStatus status, OffsetDateTime now);

    @Modifying
    @Query("""
            update EmailOutbox email
               set email.status = :pending, email.lockedAt = null
             where email.status = :processing and email.lockedAt < :cutoff
            """)
    int releaseStaleLocks(
            @Param("processing") EmailOutboxStatus processing,
            @Param("pending") EmailOutboxStatus pending,
            @Param("cutoff") OffsetDateTime cutoff);

    long deleteByExpiresAtLessThanEqual(OffsetDateTime now);
}
