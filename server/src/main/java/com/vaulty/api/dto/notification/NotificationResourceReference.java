package com.vaulty.api.dto.notification;

import java.util.UUID;

public record NotificationResourceReference(UUID workspaceId, Type type, UUID resourceId) {
    public enum Type {
        COLLECTION,
        ITEM
    }
}
