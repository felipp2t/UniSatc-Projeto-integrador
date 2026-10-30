package com.vaulty.api.dto.notification;

import java.util.List;
import org.springframework.data.domain.Page;

public record NotificationPageResponse(List<NotificationResponse> notifications, int page, int size,
                                       long totalItems, int totalPages, long unreadCount) {
    public static NotificationPageResponse from(Page<NotificationResponse> result, long unreadCount) {
        return new NotificationPageResponse(result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages(), unreadCount);
    }
}
