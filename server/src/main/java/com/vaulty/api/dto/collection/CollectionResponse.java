package com.vaulty.api.dto.collection;

import java.util.UUID;

public record CollectionResponse(UUID id, String name, UUID parentId) {
}
