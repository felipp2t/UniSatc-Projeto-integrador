package com.vaulty.api.dto.item;

import java.util.List;
import org.springframework.data.domain.Page;

public record ItemPageResponse(List<ItemResponse> items, int page, int size,
                               long totalItems, int totalPages) {
    public static ItemPageResponse from(Page<ItemResponse> result) {
        return new ItemPageResponse(result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }
}
