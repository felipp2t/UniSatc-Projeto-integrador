package com.vaulty.api.dto.activity;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ActivityEntryResponse(
        UUID id,
        UUID actorId,
        String actorName,
        String actorContext,
        String action,
        String resourceType,
        UUID resourceId,
        JsonNode snapshot,
        OffsetDateTime createdAt) {}
