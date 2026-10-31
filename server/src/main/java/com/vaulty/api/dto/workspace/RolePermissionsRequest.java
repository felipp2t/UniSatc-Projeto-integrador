package com.vaulty.api.dto.workspace;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record RolePermissionsRequest(@NotNull List<@NotNull @Valid RolePermissionRequest> permissions) {}
