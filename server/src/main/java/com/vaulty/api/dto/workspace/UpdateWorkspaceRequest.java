package com.vaulty.api.dto.workspace;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateWorkspaceRequest(
        @NotBlank(message = "Nome é obrigatório")
        @Size(min = 3, max = 100, message = "Nome deve ter entre 3 e 100 caracteres")
        String name,

        @Size(max = 2000, message = "Descrição deve ter no máximo 2000 caracteres")
        String description) {

    public UpdateWorkspaceRequest {
        name = WorkspaceTextNormalizer.normalizeName(name);
        description = WorkspaceTextNormalizer.normalizeDescription(description);
    }
}
