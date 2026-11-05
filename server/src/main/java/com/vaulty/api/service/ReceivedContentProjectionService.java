package com.vaulty.api.service;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ReceivedContentProjectionService {

    private final JdbcTemplate jdbc;

    public void refresh(UUID workspaceId, UUID destinationCollectionId) {
        jdbc.query("SELECT refresh_received_content_projection(?, ?)",
                resultSet -> null, workspaceId, destinationCollectionId);
    }
}
