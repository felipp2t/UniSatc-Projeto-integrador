package com.vaulty.api.dto.invite;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record InviteUserRequest(
        @NotBlank(message = "E-mail é obrigatório")
        @Email(message = "E-mail inválido")
        String email) {}
