package com.vaulty.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.entity.User;
import com.vaulty.api.repository.UserRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ActivityLogService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;

    public ActivityLogService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper, UserRepository userRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.userRepository = userRepository;
    }

    public void record(UUID workspaceId, UUID actorId, String actorContext, String action,
                       String resourceType, UUID resourceId, Map<String, ?> snapshot) {
        String actorName = userRepository.findById(actorId)
                .map(User::getName)
                .orElseThrow(() -> new IllegalStateException("Ator da atividade não encontrado"));
        try {
            jdbcTemplate.update("""
                    INSERT INTO activity_log
                        (id, workspace_id, actor_id, actor_name, actor_context, action, resource_type, resource_id, snapshot)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                    """,
                    UUID.randomUUID(), workspaceId, actorId, actorName, actorContext, action, resourceType,
                    resourceId, objectMapper.writeValueAsString(snapshot));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Snapshot de atividade inválido", exception);
        }
    }
}
