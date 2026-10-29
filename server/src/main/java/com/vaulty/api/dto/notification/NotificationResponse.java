package com.vaulty.api.dto.notification;

import com.vaulty.api.entity.Notification;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record NotificationResponse(UUID id, String title, String content,
                                  Map<String, Object> metadata, OffsetDateTime readAt,
                                  OffsetDateTime createdAt) {
    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(notification.getId(), notification.getTitle(), notification.getContent(),
                notification.getMetadata(),
                notification.getReadAt(), notification.getCreatedAt());
    }
}
