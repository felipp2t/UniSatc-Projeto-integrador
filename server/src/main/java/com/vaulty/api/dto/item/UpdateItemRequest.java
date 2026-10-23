package com.vaulty.api.dto.item;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateItemRequest(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 2000) String description,
        @Size(max = 100000) String textContent,
        @Size(max = 2048) String linkUrl,
        @Size(max = 8192) String value) {
    public UpdateItemRequest {
        title = title == null ? null : title.trim();
    }
}
