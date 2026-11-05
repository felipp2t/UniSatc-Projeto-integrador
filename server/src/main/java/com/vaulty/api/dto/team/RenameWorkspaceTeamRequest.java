package com.vaulty.api.dto.team;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RenameWorkspaceTeamRequest(
        @NotBlank(message = "Nome do time é obrigatório")
        @Size(min = 1, max = 50, message = "Nome do time deve ter entre 1 e 50 caracteres")
        String name) {

    public RenameWorkspaceTeamRequest {
        name = name == null ? null : name.trim();
    }
}
