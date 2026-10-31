package com.vaulty.api.dto.workspace;

import jakarta.validation.constraints.NotBlank;

public record RolePermissionRequest(
        @NotBlank String resource,
        @NotBlank String action) {}
