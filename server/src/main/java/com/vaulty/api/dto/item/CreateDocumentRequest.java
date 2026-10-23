package com.vaulty.api.dto.item;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateDocumentRequest(@NotBlank @Size(max = 255) String title,
                                    @Size(max = 2000) String description,
                                    UUID collectionId) {
    public CreateDocumentRequest {
        title = title == null ? null : title.trim();
    }
}
