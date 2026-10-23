package com.vaulty.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.entity.User;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.repository.UserRepository;
import java.util.Map;
import java.util.Locale;
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

    public void record(UUID workspaceId, UUID actorId, ActivityActorContext actorContext, ActivityAction action,
                       ActivityResourceType resourceType, UUID resourceId, Map<String, ?> snapshot) {
        String actorName = userRepository.findById(actorId)
                .map(User::getName)
                .orElseThrow(() -> new IllegalStateException("Ator da atividade não encontrado"));
        insert(workspaceId, actorId, actorName, actorContext, action, resourceType, resourceId, snapshot);
    }

    public void recordInviteeEmail(UUID workspaceId, String email, ActivityAction action,
                                   ActivityResourceType resourceType, UUID resourceId, Map<String, ?> snapshot) {
        insert(workspaceId, null, email, ActivityActorContext.INVITEE_EMAIL, action, resourceType, resourceId, snapshot);
    }

    private void insert(UUID workspaceId, UUID actorId, String actorName, ActivityActorContext actorContext,
                        ActivityAction action, ActivityResourceType resourceType, UUID resourceId,
                        Map<String, ?> snapshot) {
        try {
            jdbcTemplate.update("""
                    INSERT INTO activity_log
                        (id, workspace_id, actor_id, actor_name, actor_context, action, resource_type, resource_id, snapshot)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                    """,
                    UUID.randomUUID(), workspaceId, actorId, actorName, actorContext.name(),
                    action.name().toLowerCase(Locale.ROOT), resourceType.name().toLowerCase(Locale.ROOT),
                    resourceId, objectMapper.writeValueAsString(snapshot));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Snapshot de atividade inválido", exception);
        }
    }
}
