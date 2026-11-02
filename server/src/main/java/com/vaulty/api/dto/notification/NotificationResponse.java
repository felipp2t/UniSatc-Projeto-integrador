package com.vaulty.api.dto.notification;

import com.vaulty.api.entity.Notification;
import com.vaulty.api.enums.NotificationEvent;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record NotificationResponse(UUID id, String title, String content,
                                  Map<String, Object> metadata, OffsetDateTime readAt,
                                  OffsetDateTime createdAt) {
    public static NotificationResponse from(Notification notification) {
        if (NotificationEvent.ACCESS_CHANGED.name().equals(notification.getMetadata().get("event"))) {
            NotificationEvent event = NotificationEvent.ACCESS_CHANGED;
            return new NotificationResponse(notification.getId(), event.title(), event.content(),
                    Map.of("event", event.name()), notification.getReadAt(), notification.getCreatedAt());
        }
        return new NotificationResponse(notification.getId(), notification.getTitle(), notification.getContent(),
                notification.getMetadata(),
                notification.getReadAt(), notification.getCreatedAt());
    }
}
