package com.vaulty.api.dto.collection;

import java.util.List;
import org.springframework.data.domain.Page;

public record CollectionPageResponse(
        List<CollectionResponse> items,
        int page,
        int size,
        long totalItems,
        int totalPages) {

    public static CollectionPageResponse from(Page<CollectionResponse> result) {
        return new CollectionPageResponse(
                result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }
}
