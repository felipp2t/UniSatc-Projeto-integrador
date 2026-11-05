package com.vaulty.api.service;

import com.vaulty.api.dto.item.ItemResponse;
import com.vaulty.api.dto.item.SecretValueResponse;
import com.vaulty.api.dto.sharing.ReceivedContentPage;
import com.vaulty.api.dto.sharing.ReceivedItemResponse;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.enums.GlobalRole;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.repository.WorkspaceItemRepository;
import com.vaulty.api.repository.WorkspaceItemSecretRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReceivedContentService {

    private static final String RECEIVED_CTE = """
            WITH RECURSIVE authorized AS (
                SELECT projection.id, projection.destination_collection_id, projection.original_type,
                       COALESCE(item.id, folder.id, projection.original_collection_id) AS original_id,
                       COALESCE(item.title, folder.name, projection.captured_name) AS title,
                       CASE WHEN projection.original_type = 'ITEM' THEN item.type ELSE 'folder' END AS entry_type,
                       projection.source_team_name, projection.captured_path,
                       projection.received_parent_collection_id
                FROM received_content_projection projection
                LEFT JOIN item ON item.id = projection.original_item_id
                LEFT JOIN collection folder ON folder.id = projection.original_collection_id
                JOIN workspace_member member
                  ON member.workspace_id = projection.workspace_id AND member.user_id = ?
                JOIN workspace ON workspace.id = projection.workspace_id
                LEFT JOIN workspace_team team ON team.id = member.team_id
                WHERE projection.workspace_id = ?
                  AND (item.id IS NULL OR item.archived_at IS NULL)
                  AND (workspace.owner_id = member.user_id
                       OR member.global_role IN ('ADMIN', 'MAINTAINER')
                       OR projection.destination_collection_id = team.root_collection_id)
            ), received AS (
                SELECT id, destination_collection_id, original_type, original_id, title, entry_type,
                       source_team_name, received_parent_collection_id,
                       concat_ws('/', nullif(captured_path, ''), title) AS path
                FROM authorized WHERE received_parent_collection_id IS NULL
                UNION ALL
                SELECT child.id, child.destination_collection_id, child.original_type, child.original_id,
                       child.title, child.entry_type, child.source_team_name,
                       child.received_parent_collection_id, concat_ws('/', parent.path, child.title)
                FROM authorized child JOIN received parent
                  ON parent.destination_collection_id = child.destination_collection_id
                 AND parent.original_type = 'COLLECTION'
                 AND parent.original_id = child.received_parent_collection_id
            )
            """;

    private final JdbcTemplate jdbc;
    private final WorkspaceContentAuthorization authorization;
    private final WorkspaceMemberRepository memberRepository;
    private final WorkspaceItemRepository itemRepository;
    private final WorkspaceItemSecretRepository secretRepository;
    private final WorkspaceItemAttachmentService attachmentService;
    private final SecretCipher secretCipher;
    private final WorkspaceAccessNotifications accessNotifications;
    private final ReceivedContentProjectionService receivedProjection;
    private final EntityManager entityManager;

    @Transactional
    public ReceivedContentPage list(UUID userId, UUID workspaceId, String query, boolean contentOnly,
            int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException("Página ou tamanho inválido");
        }
        if (query != null && (query.isBlank() || query.trim().length() > 255)) {
            throw new ValidationException("Busca deve conter entre 1 e 255 caracteres");
        }
        var member = member(userId, workspaceId);
        refresh(member, userId, workspaceId);
        String filter = query == null ? "" : " WHERE position(lower(?) in lower(title)) > 0";
        if (contentOnly) {
            filter += query == null ? " WHERE original_type = 'ITEM'" : " AND original_type = 'ITEM'";
        }
        var countArgs = query == null
                ? new Object[] {userId, workspaceId}
                : new Object[] {userId, workspaceId, query.trim()};
        long total = jdbc.queryForObject(RECEIVED_CTE + "SELECT count(*) FROM received" + filter,
                Long.class, countArgs);
        String pageFilter = filter;
        String sql = RECEIVED_CTE + "SELECT id, entry_type, title, source_team_name, path FROM received"
                + pageFilter + " ORDER BY path, title, id LIMIT ? OFFSET ?";
        Object[] pageArgs = query == null
                ? new Object[] {userId, workspaceId, size, page * size}
                : new Object[] {userId, workspaceId, query.trim(), size, page * size};
        List<ReceivedItemResponse> items = jdbc.query(sql, (resultSet, row) -> new ReceivedItemResponse(
                resultSet.getObject("id", UUID.class), resultSet.getString("entry_type"),
                resultSet.getString("title"), resultSet.getString("source_team_name"),
                resultSet.getString("path"), true, true), pageArgs);
        int totalPages = total == 0 ? 0 : (int) ((total + size - 1) / size);
        return new ReceivedContentPage(items, page, size, total, totalPages);
    }

    @Transactional
    public ReceivedItemResponse path(UUID userId, UUID workspaceId, UUID virtualId) {
        return response(resolve(userId, workspaceId, virtualId));
    }

    @Transactional
    public ItemResponse read(UUID userId, UUID workspaceId, UUID virtualId) {
        var entry = resolve(userId, workspaceId, virtualId);
        if ("folder".equals(entry.type())) throw unavailable();
        var item = itemRepository.findByIdAndWorkspaceIdAndArchivedAtIsNull(entry.originalId(), workspaceId)
                .orElseThrow(ReceivedContentService::unavailable);
        String preview = switch (item.getType()) {
            case "text" -> truncate(item.getTextContent());
            case "link" -> truncate(item.getLinkUrl());
            default -> null;
        };
        return new ItemResponse(virtualId, item.getType(), item.getTitle(), null, item.getTextContent(),
                item.getLinkUrl(), preview, item.getDescription(), item.getArchivedAt());
    }

    @Transactional
    public SecretValueResponse secret(UUID userId, UUID workspaceId, UUID virtualId) {
        var entry = resolve(userId, workspaceId, virtualId);
        if (!"secret".equals(entry.type())) throw unavailable();
        var secret = secretRepository.findById(entry.originalId()).orElseThrow(ReceivedContentService::unavailable);
        return new SecretValueResponse(secretCipher.decrypt(secret.getValue()));
    }

    @Transactional
    public AttachmentDownload attachment(UUID userId, UUID workspaceId, UUID virtualId) {
        var entry = resolve(userId, workspaceId, virtualId);
        if (!"file".equals(entry.type()) && !"image".equals(entry.type())) throw unavailable();
        return attachmentService.downloadReceived(entry.originalId());
    }

    private ReceivedEntry resolve(UUID userId, UUID workspaceId, UUID virtualId) {
        var member = member(userId, workspaceId);
        UUID destinationCollectionId = jdbc.query("""
                SELECT projection.destination_collection_id
                FROM received_content_projection projection
                JOIN workspace_member member
                  ON member.workspace_id = projection.workspace_id AND member.user_id = ?
                JOIN workspace ON workspace.id = projection.workspace_id
                LEFT JOIN workspace_team team ON team.id = member.team_id
                WHERE projection.workspace_id = ? AND projection.id = ?
                  AND (workspace.owner_id = member.user_id
                       OR member.global_role IN ('ADMIN', 'MAINTAINER')
                       OR projection.destination_collection_id = team.root_collection_id)
                """, resultSet -> resultSet.next()
                ? resultSet.getObject("destination_collection_id", UUID.class) : null,
                userId, workspaceId, virtualId);
        if (destinationCollectionId == null) throw unavailable();
        receivedProjection.refresh(workspaceId, destinationCollectionId);
        ReceivedEntry entry = jdbc.query(RECEIVED_CTE + "SELECT id, original_id, entry_type, title, source_team_name, path "
                        + "FROM received WHERE id = ?",
                resultSet -> resultSet.next() ? new ReceivedEntry(
                        resultSet.getObject("id", UUID.class), resultSet.getObject("original_id", UUID.class),
                        resultSet.getString("entry_type"), resultSet.getString("title"),
                        resultSet.getString("source_team_name"), resultSet.getString("path")) : null,
                userId, workspaceId, virtualId);
        if (entry == null) throw unavailable();
        return entry;
    }

    private WorkspaceMember member(UUID userId, UUID workspaceId) {
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "read");
        return memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(ReceivedContentService::unavailable);
    }

    private void refresh(WorkspaceMember member, UUID userId, UUID workspaceId) {
        if (member.getTeam() != null) {
            receivedProjection.refresh(workspaceId, member.getTeam().getRootCollection().getId());
        } else if (member.getGlobalRole() == GlobalRole.ADMIN || member.getGlobalRole() == GlobalRole.MAINTAINER
                || authorization.isOwner(userId, member.getWorkspace())) {
            receivedProjection.refresh(workspaceId, null);
        }
    }

    private ReceivedItemResponse response(ReceivedEntry entry) {
        return new ReceivedItemResponse(entry.id(), entry.type(), entry.title(),
                entry.sourceTeamName(), entry.path(), true, true);
    }

    private String truncate(String value) {
        return value == null || value.length() <= 80 ? value : value.substring(0, 79) + "…";
    }

    private static ResourceNotFoundException unavailable() {
        return new ResourceNotFoundException("Conteúdo recebido indisponível");
    }

    private record ReceivedEntry(UUID id, UUID originalId, String type, String title,
                                 String sourceTeamName, String path) {
    }
}
