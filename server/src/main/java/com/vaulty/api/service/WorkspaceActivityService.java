package com.vaulty.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.dto.activity.ActivityEntryResponse;
import com.vaulty.api.dto.activity.ActivityPageResponse;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ValidationException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceActivityService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ACTIONS = Arrays.stream(ActivityAction.values())
            .map(value -> value.name().toLowerCase(Locale.ROOT))
            .collect(Collectors.toUnmodifiableSet());
    private static final Set<String> RESOURCE_TYPES = Arrays.stream(ActivityResourceType.values())
            .map(value -> value.name().toLowerCase(Locale.ROOT))
            .collect(Collectors.toUnmodifiableSet());
    private static final String VISIBILITY_FILTER = """
              AND (
                    :owner OR (
                        activity.action NOT IN ('folder_deleted', 'item_deleted') AND (
                            (activity.resource_type = 'folder' AND :canReadCollections
                                AND EXISTS (SELECT 1 FROM collection content
                                            WHERE content.id = activity.resource_id
                                              AND content.workspace_id = activity.workspace_id))
                            OR
                            (activity.resource_type = 'item' AND :canReadItems
                                AND EXISTS (SELECT 1 FROM item content
                                            WHERE content.id = activity.resource_id
                                              AND content.workspace_id = activity.workspace_id
                                              AND (content.type <> 'secret' OR :canReadSecrets)))
                        )
                    )
              )
            """;

    private static final String BASE_QUERY = """
            FROM activity_log activity
            WHERE activity.workspace_id = :workspaceId
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final WorkspaceContentAuthorization authorization;

    @Transactional(readOnly = true)
    public ActivityPageResponse list(UUID userId, UUID workspaceId, int page, int size,
                                     OffsetDateTime from, OffsetDateTime to, UUID actorId,
                                     String action, String resourceType) {
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "activity", "read");
        validateFilters(page, size, from, to, action, resourceType);

        boolean owner = authorization.isOwner(userId, workspace);
        var query = new StringBuilder(BASE_QUERY);
        var parameters = new MapSqlParameterSource()
                .addValue("workspaceId", workspaceId)
                .addValue("owner", owner)
                .addValue("canReadCollections", owner || authorization.allows(userId, workspace, "collection", "read"))
                .addValue("canReadItems", owner || authorization.allows(userId, workspace, "item", "read"))
                .addValue("canReadSecrets", owner || authorization.allows(userId, workspace, "secret", "read"));
        query.append(VISIBILITY_FILTER);
        addFilter(query, parameters, from, "activity.created_at >= :fromTime", "fromTime");
        addFilter(query, parameters, to, "activity.created_at <= :toTime", "toTime");
        addFilter(query, parameters, actorId, "activity.actor_id = :actorId", "actorId");
        addFilter(query, parameters, action, "activity.action = :action", "action");
        addFilter(query, parameters, resourceType, "activity.resource_type = :resourceType", "resourceType");

        long totalItems = jdbcTemplate.queryForObject("SELECT count(*) " + query, parameters, Long.class);
        int offset = page * size;
        var activities = jdbcTemplate.query("""
                SELECT activity.id, activity.actor_id, activity.actor_name, activity.actor_context,
                       activity.action, activity.resource_type, activity.resource_id,
                       activity.snapshot::text AS snapshot, activity.created_at
                """ + query + " ORDER BY activity.created_at DESC, activity.id DESC LIMIT :size OFFSET :offset",
                parameters.addValue("size", size).addValue("offset", offset), rowMapper());
        int totalPages = totalItems == 0 ? 0 : Math.toIntExact((totalItems - 1) / size + 1);
        return new ActivityPageResponse(activities, page, size, totalItems, totalPages);
    }

    private void addFilter(StringBuilder query, MapSqlParameterSource parameters, Object value,
                           String condition, String parameter) {
        if (value != null) {
            query.append(" AND ").append(condition);
            parameters.addValue(parameter, value);
        }
    }

    private void validateFilters(int page, int size, OffsetDateTime from, OffsetDateTime to,
                                 String action, String resourceType) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE || (long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException("Página ou tamanho inválido");
        }
        if (from != null && to != null && from.isAfter(to)) {
            throw new ValidationException("O início do período deve ser anterior ao fim");
        }
        if (action != null && !ACTIONS.contains(action)) {
            throw new ValidationException("Ação de atividade inválida");
        }
        if (resourceType != null && !RESOURCE_TYPES.contains(resourceType)) {
            throw new ValidationException("Tipo de recurso de atividade inválido");
        }
    }

    private RowMapper<ActivityEntryResponse> rowMapper() {
        return (result, rowNumber) -> toResponse(result);
    }

    private ActivityEntryResponse toResponse(ResultSet result) throws SQLException {
        try {
            return new ActivityEntryResponse(
                    result.getObject("id", UUID.class),
                    result.getObject("actor_id", UUID.class),
                    result.getString("actor_name"),
                    result.getString("actor_context"),
                    result.getString("action"),
                    result.getString("resource_type"),
                    result.getObject("resource_id", UUID.class),
                    objectMapper.readTree(result.getString("snapshot")),
                    result.getObject("created_at", OffsetDateTime.class));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Snapshot de atividade inválido", exception);
        }
    }
}
