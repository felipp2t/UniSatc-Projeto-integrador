package com.vaulty.api.dto.sharing;

import java.util.List;

public record ReceivedContentPage(List<ReceivedItemResponse> items, int page, int size,
                                  long totalItems, int totalPages) {
}
