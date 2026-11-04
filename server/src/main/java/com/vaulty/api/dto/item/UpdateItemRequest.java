package com.vaulty.api.dto.item;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateItemRequest(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 100000, message = "Texto deve ter no máximo 100.000 caracteres") String textContent,
        @Size(max = 2048, message = "URL deve ter no máximo 2.048 caracteres") String linkUrl,
        @Size(max = 8192, message = "Segredo deve ter no máximo 8.192 caracteres") String value) {
    public UpdateItemRequest {
        title = title == null ? null : title.trim();
    }
}
