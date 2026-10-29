package com.vaulty.api.dto.item;

import java.util.UUID;

public record ItemResponse(UUID id, String type, String title, UUID collectionId,
                           String textContent, String linkUrl, String preview, String description) {
}
