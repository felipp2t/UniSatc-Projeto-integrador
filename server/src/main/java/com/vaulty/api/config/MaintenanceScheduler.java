package com.vaulty.api.config;

import com.vaulty.api.service.EmailOutboxProcessor;
import com.vaulty.api.service.ExpiredAuthDataCleanupService;
import com.vaulty.api.service.NotificationService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class MaintenanceScheduler {

    private final EmailOutboxProcessor emailOutboxProcessor;
    private final ExpiredAuthDataCleanupService expiredAuthDataCleanupService;
    private final RateLimitRegistry rateLimitRegistry;
    private final NotificationService notificationService;

    public MaintenanceScheduler(
            EmailOutboxProcessor emailOutboxProcessor,
            ExpiredAuthDataCleanupService expiredAuthDataCleanupService,
            RateLimitRegistry rateLimitRegistry,
            NotificationService notificationService) {
        this.emailOutboxProcessor = emailOutboxProcessor;
        this.expiredAuthDataCleanupService = expiredAuthDataCleanupService;
        this.rateLimitRegistry = rateLimitRegistry;
        this.notificationService = notificationService;
    }

    @Scheduled(fixedDelayString = "${app.notifications.heartbeat-interval-ms:25000}")
    public void sendNotificationHeartbeat() {
        notificationService.sendHeartbeat();
    }

    @Scheduled(fixedDelayString = "${app.mail.outbox.poll-interval-ms:5000}")
    public void sendPendingEmail() {
        emailOutboxProcessor.processNext();
    }

    @Scheduled(fixedDelayString = "${app.maintenance.interval-ms:60000}")
    public void cleanup() {
        emailOutboxProcessor.performMaintenance();
        expiredAuthDataCleanupService.cleanup();
        rateLimitRegistry.cleanupInactive();
    }
}
