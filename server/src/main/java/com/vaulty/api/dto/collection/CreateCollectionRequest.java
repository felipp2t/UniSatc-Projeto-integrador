package com.vaulty.api.dto.collection;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateCollectionRequest(
        @NotBlank(message = "Nome da pasta é obrigatório")
        @Size(max = 255, message = "Nome da pasta deve ter no máximo 255 caracteres")
        String name,
        UUID parentId) {

    public CreateCollectionRequest {
        name = name == null ? null : name.trim();
    }
}
