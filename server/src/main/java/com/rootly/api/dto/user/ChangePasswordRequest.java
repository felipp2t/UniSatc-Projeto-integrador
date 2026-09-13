package com.rootly.api.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank(message = "Senha atual é obrigatória")
        String currentPassword,

        @NotBlank(message = "Nova senha é obrigatória")
        @Size(min = 8, message = "Nova senha deve ter no mínimo 8 caracteres")
        String newPassword,

        @NotBlank(message = "Confirmação de senha é obrigatória")
        @Size(min = 8, message = "Confirmação de senha deve ter no mínimo 8 caracteres")
        String confirmPassword) {}
