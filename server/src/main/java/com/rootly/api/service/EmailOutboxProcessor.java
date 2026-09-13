package com.rootly.api.service;

import com.rootly.api.entity.EmailOutbox;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class EmailOutboxProcessor {

    private static final Logger LOGGER = LoggerFactory.getLogger(EmailOutboxProcessor.class);

    private final EmailOutboxStore store;
    private final MailService mailService;
    private final Clock clock;

    public EmailOutboxProcessor(EmailOutboxStore store, MailService mailService, Clock clock) {
        this.store = store;
        this.mailService = mailService;
        this.clock = clock;
    }

    public boolean processNext() {
        Optional<EmailOutbox> claimed = store.claimNext();
        if (claimed.isEmpty()) {
            return false;
        }

        EmailOutbox email = claimed.get();
        if (!email.getExpiresAt().isAfter(OffsetDateTime.now(clock))) {
            store.markFailed(email.getId(), new IllegalStateException("Mensagem expirada"));
            return true;
        }

        try {
            mailService.send(email);
            store.markDelivered(email.getId());
        } catch (RuntimeException failure) {
            store.markFailed(email.getId(), failure);
            LOGGER.warn("Falha ao enviar e-mail da outbox {} (tentativa {})", email.getId(), email.getAttempts() + 1);
        }
        return true;
    }

    public void performMaintenance() {
        store.releaseStaleLocks();
        store.deleteExpired();
    }
}
