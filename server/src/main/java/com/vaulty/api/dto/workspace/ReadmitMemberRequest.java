package com.vaulty.api.dto.workspace;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ReadmitMemberRequest(
        @NotBlank(message = "E-mail é obrigatório")
        @Email(message = "E-mail inválido")
        String email) {

    public ReadmitMemberRequest {
        email = email == null ? null : email.trim();
    }
}
