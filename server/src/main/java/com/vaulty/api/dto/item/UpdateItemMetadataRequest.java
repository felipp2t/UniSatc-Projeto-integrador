package com.vaulty.api.dto.item;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record UpdateItemMetadataRequest(@NotBlank @Size(max = 255) String title,
                                        @Size(max = 2000) String description,
                                        UUID collectionId) {
    public UpdateItemMetadataRequest {
        title = title == null ? null : title.trim();
        description = description == null || description.isBlank() ? null : description.trim();
    }
}
