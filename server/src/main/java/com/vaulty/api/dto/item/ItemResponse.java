package com.vaulty.api.dto.item;

import java.util.UUID;
import java.time.OffsetDateTime;

public record ItemResponse(UUID id, String type, String title, UUID collectionId,
                           String textContent, String linkUrl, String preview,
                           String description, OffsetDateTime archivedAt, AttachmentResponse attachment) {
}
