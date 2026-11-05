package com.vaulty.api.dto.sharing;

import java.util.UUID;

public record ReceivedItemResponse(UUID id, String type, String title,
                                   String sourceTeamName, String path, boolean received, boolean readOnly) {
}
