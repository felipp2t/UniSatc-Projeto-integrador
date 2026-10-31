package com.vaulty.api.config;

import com.vaulty.api.service.EmailOutboxProcessor;
import com.vaulty.api.service.ExpiredAuthDataCleanupService;
import com.vaulty.api.service.MaintenanceGate;
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
    private final MaintenanceGate maintenanceGate;

    public MaintenanceScheduler(
            EmailOutboxProcessor emailOutboxProcessor,
            ExpiredAuthDataCleanupService expiredAuthDataCleanupService,
            RateLimitRegistry rateLimitRegistry,
            NotificationService notificationService,
            MaintenanceGate maintenanceGate) {
        this.emailOutboxProcessor = emailOutboxProcessor;
        this.expiredAuthDataCleanupService = expiredAuthDataCleanupService;
        this.rateLimitRegistry = rateLimitRegistry;
        this.notificationService = notificationService;
        this.maintenanceGate = maintenanceGate;
    }

    @Scheduled(fixedDelayString = "${app.notifications.heartbeat-interval-ms:25000}")
    public void sendNotificationHeartbeat() {
        notificationService.sendHeartbeat();
    }

    @Scheduled(fixedDelayString = "${app.mail.outbox.poll-interval-ms:5000}")
    public void sendPendingEmail() {
        whilePaused(() -> emailOutboxProcessor.processNext());
    }

    @Scheduled(fixedDelayString = "${app.maintenance.interval-ms:60000}")
    public void cleanup() {
        whilePaused(() -> {
            emailOutboxProcessor.performMaintenance();
            expiredAuthDataCleanupService.cleanup();
            rateLimitRegistry.cleanupInactive();
        });
    }

    private void whilePaused(Runnable task) {
        try (MaintenanceGate.Lease ignored = maintenanceGate.enterBackgroundWriter()) {
            task.run();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
