package com.vaulty.api.dto.activity;

import java.util.List;

public record ActivityPageResponse(
        List<ActivityEntryResponse> activities,
        int page,
        int size,
        long totalItems,
        int totalPages) {}
