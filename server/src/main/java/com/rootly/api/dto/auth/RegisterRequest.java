package com.rootly.api.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "E-mail é obrigatório")
        @Email(message = "E-mail inválido")
        String email,

        @NotBlank(message = "Token de convite é obrigatório")
        String token,

        @NotBlank(message = "Nome é obrigatório")
        @Size(min = 3, max = 255, message = "Nome deve ter entre 3 e 255 caracteres")
        String name,

        @NotBlank(message = "Senha é obrigatória")
        @Size(min = 8, message = "Senha deve ter no mínimo 8 caracteres")
        String password,

        @NotBlank(message = "Confirmação de senha é obrigatória")
        @Size(min = 8, message = "Confirmação de senha deve ter no mínimo 8 caracteres")
        String confirmPassword) {

    public RegisterRequest {
        name = name == null ? null : name.trim();
    }
}
