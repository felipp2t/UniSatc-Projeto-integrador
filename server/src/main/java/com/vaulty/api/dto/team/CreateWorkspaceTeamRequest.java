package com.vaulty.api.dto.team;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateWorkspaceTeamRequest(
        @NotBlank(message = "Nome do time é obrigatório")
        @Size(min = 1, max = 50, message = "Nome do time deve ter entre 1 e 50 caracteres")
        String name,
        @NotNull(message = "Líder do time é obrigatório") UUID leaderMemberId,
        UUID rootCollectionId) {

    public CreateWorkspaceTeamRequest {
        name = name == null ? null : name.trim();
    }
}
