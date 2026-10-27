package com.vaulty.api.dto.accessgroup;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AccessGroupRequest(
        @NotBlank(message = "Nome do grupo é obrigatório")
        @Size(min = 1, max = 50, message = "Nome do grupo deve ter entre 1 e 50 caracteres")
        String name) {

    public AccessGroupRequest {
        name = name == null ? null : name.trim();
    }
}
