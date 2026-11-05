package com.vaulty.api.dto.sharing;

import java.util.List;
import java.util.UUID;

public record PublicationConfiguration(
        UUID sourceCollectionId,
        List<DestinationTeam> destinationTeams,
        List<PublicationResponse> publications) {

    public record DestinationTeam(UUID id, String name, UUID collectionId) {}
}
