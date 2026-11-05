package com.vaulty.api.dto.sharing;

import com.vaulty.api.enums.ContentPublicationType;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreatePublicationRequest(
        @NotNull ContentPublicationType originalType,
        @NotNull UUID originalId,
        @NotNull UUID destinationTeamId) {}
