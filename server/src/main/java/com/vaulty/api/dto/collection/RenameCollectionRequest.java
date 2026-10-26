package com.vaulty.api.dto.collection;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RenameCollectionRequest(
        @NotBlank(message = "Nome da pasta é obrigatório")
        @Size(max = 255, message = "Nome da pasta deve ter no máximo 255 caracteres")
        String name) {
    public RenameCollectionRequest {
        name = name == null ? null : name.trim();
    }
}
