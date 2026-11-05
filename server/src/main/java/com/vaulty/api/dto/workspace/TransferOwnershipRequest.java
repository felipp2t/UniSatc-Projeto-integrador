package com.vaulty.api.dto.workspace;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record TransferOwnershipRequest(@NotNull UUID memberId) {}
