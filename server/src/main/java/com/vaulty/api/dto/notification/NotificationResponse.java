package com.vaulty.api.dto.notification;

import com.vaulty.api.entity.Notification;
import com.vaulty.api.enums.NotificationEvent;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.Locale;

public record NotificationResponse(UUID id, String title, String content,
                                  Map<String, Object> metadata, OffsetDateTime readAt,
                                  OffsetDateTime createdAt) {
    public static NotificationResponse from(Notification notification, NotificationResourceReference reference) {
        NotificationEvent event = event(notification.getMetadata().get("event"));
        Map<String, Object> metadata = reference == null || event != NotificationEvent.ACCESS_CHANGED
                ? Map.of("event", event.name())
                : Map.of("event", event.name(), "resourceType", reference.type().name().toLowerCase(Locale.ROOT),
                        "resourceId", reference.resourceId());
        return new NotificationResponse(notification.getId(), event.title(), event.content(), metadata,
                notification.getReadAt(), notification.getCreatedAt());
    }

    private static NotificationEvent event(Object value) {
        if (value instanceof String name) {
            try {
                return NotificationEvent.valueOf(name);
            } catch (IllegalArgumentException ignored) {
                // Unknown legacy events are returned as a generic access notice.
            }
        }
        return NotificationEvent.ACCESS_CHANGED;
    }
}
