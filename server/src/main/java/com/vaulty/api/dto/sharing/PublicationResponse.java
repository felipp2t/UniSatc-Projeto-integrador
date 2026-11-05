package com.vaulty.api.dto.sharing;

import com.vaulty.api.enums.ContentPublicationType;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PublicationResponse(
        UUID id,
        ContentPublicationType originalType,
        UUID originalId,
        UUID sourceCollectionId,
        UUID destinationCollectionId,
        String sourceTeamName,
        String capturedPath,
        OffsetDateTime createdAt) {}
