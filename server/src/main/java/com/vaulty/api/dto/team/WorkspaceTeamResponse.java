package com.vaulty.api.dto.team;

import java.util.UUID;

public record WorkspaceTeamResponse(
        UUID id,
        String name,
        UUID rootCollectionId,
        String rootCollectionName,
        UUID leaderMemberId,
        String leaderName,
        long memberCount) {}
