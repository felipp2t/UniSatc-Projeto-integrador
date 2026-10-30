package com.vaulty.api.dto.workspace;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ChangeMemberRoleRequest(@NotNull(message = "Papel é obrigatório") UUID roleId) {}
