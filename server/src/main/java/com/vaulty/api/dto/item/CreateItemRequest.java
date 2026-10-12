package com.vaulty.api.dto.item;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateItemRequest(
        @NotNull String type,
        @NotBlank @Size(max = 255) String title,
        UUID collectionId,
        String textContent,
        String linkUrl,
        String value) {
    public CreateItemRequest {
        title = title == null ? null : title.trim();
    }
}
