package com.vaulty.api.dto.item;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateItemRequest(
        @NotNull String type,
        @NotBlank @Size(max = 255) String title,
        UUID collectionId,
        @Size(max = 2000) String description,
        @Size(max = 100000, message = "Texto deve ter no máximo 100.000 caracteres") String textContent,
        @Size(max = 2048, message = "URL deve ter no máximo 2.048 caracteres") String linkUrl,
        @Size(max = 8192, message = "Segredo deve ter no máximo 8.192 caracteres") String value) {
    public CreateItemRequest {
        title = title == null ? null : title.trim();
    }

    public CreateItemRequest(String type, String title, UUID collectionId, String textContent,
                             String linkUrl, String value) {
        this(type, title, collectionId, null, textContent, linkUrl, value);
    }
}
