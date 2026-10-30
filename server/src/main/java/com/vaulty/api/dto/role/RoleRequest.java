package com.vaulty.api.dto.role;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RoleRequest(
        @NotBlank(message = "Nome do papel é obrigatório")
        @Size(min = 1, max = 50, message = "Nome do papel deve ter entre 1 e 50 caracteres")
        String name) {

    public RoleRequest {
        name = name == null ? null : name.trim();
    }
}
