package com.rootly.api.service;

import com.rootly.api.entity.EmailOutbox;
import com.rootly.api.entity.EmailOutboxStatus;
import com.rootly.api.repository.EmailOutboxRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailOutboxStore {

    private static final int MAX_ATTEMPTS = 5;
    private static final Duration STALE_LOCK_AGE = Duration.ofMinutes(5);
    private static final List<Duration> RETRY_DELAYS = List.of(
            Duration.ofSeconds(5), Duration.ofSeconds(30), Duration.ofMinutes(2), Duration.ofMinutes(10));

    private final EmailOutboxRepository repository;
    private final Clock clock;

    public EmailOutboxStore(EmailOutboxRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<EmailOutbox> claimNext() {
        OffsetDateTime now = OffsetDateTime.now(clock);
        return repository
                .findFirstByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(EmailOutboxStatus.PENDING, now)
                .map(email -> {
                    email.setStatus(EmailOutboxStatus.PROCESSING);
                    email.setLockedAt(now);
                    return repository.save(email);
                });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markDelivered(UUID id) {
        repository.deleteById(id);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(UUID id, RuntimeException failure) {
        repository.findById(id).ifPresent(email -> {
            OffsetDateTime now = OffsetDateTime.now(clock);
            int attempts = email.getAttempts() + 1;
            email.setAttempts(attempts);
            email.setLockedAt(null);
            email.setLastError(sanitize(failure));

            if (attempts >= MAX_ATTEMPTS || !email.getExpiresAt().isAfter(now)) {
                email.setStatus(EmailOutboxStatus.FAILED);
            } else {
                email.setStatus(EmailOutboxStatus.PENDING);
                email.setNextAttemptAt(now.plus(RETRY_DELAYS.get(attempts - 1)));
            }
            repository.save(email);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int releaseStaleLocks() {
        OffsetDateTime cutoff = OffsetDateTime.now(clock).minus(STALE_LOCK_AGE);
        return repository.releaseStaleLocks(EmailOutboxStatus.PROCESSING, EmailOutboxStatus.PENDING, cutoff);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public long deleteExpired() {
        return repository.deleteByExpiresAtLessThanEqual(OffsetDateTime.now(clock));
    }

    private String sanitize(RuntimeException failure) {
        String value = failure.getClass().getSimpleName() + ": " + String.valueOf(failure.getMessage());
        return value.substring(0, Math.min(value.length(), 1000));
    }
}
