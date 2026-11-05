package com.vaulty.api.service;

import com.vaulty.api.dto.item.CreateItemRequest;
import com.vaulty.api.dto.item.ItemPageResponse;
import com.vaulty.api.dto.item.ItemResponse;
import com.vaulty.api.dto.item.SecretValueResponse;
import com.vaulty.api.dto.item.UpdateItemRequest;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceItem;
import com.vaulty.api.entity.WorkspaceItemSecret;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.repository.PersistenceConstraints;
import com.vaulty.api.repository.WorkspaceCollectionRepository;
import com.vaulty.api.repository.WorkspaceItemRepository;
import com.vaulty.api.repository.WorkspaceItemSecretRepository;
import jakarta.persistence.EntityManager;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceItemService {

    private static final String DUPLICATE_TITLE_CONSTRAINT = "uq_item_workspace_collection_title";
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_PREVIEW_LENGTH = 80;

    private final WorkspaceItemRepository itemRepository;
    private final WorkspaceItemSecretRepository secretRepository;
    private final WorkspaceCollectionRepository collectionRepository;
    private final WorkspaceContentAuthorization authorization;
    private final EffectiveContentAccess contentAccess;
    private final SecretCipher secretCipher;
    private final ActivityLogService activityLogService;
    private final WorkspaceItemAttachmentService attachmentService;
    private final WorkspaceAccessNotifications accessNotifications;
    private final EntityManager entityManager;

    @Transactional
    public ItemResponse create(UUID userId, UUID workspaceId, CreateItemRequest request) {
        lockWorkspace(workspaceId);
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "create");
        validateContent(request);
        var collection = request.collectionId() == null ? null
                : collectionRepository.findByIdAndWorkspaceId(request.collectionId(), workspaceId)
                        .orElseThrow(() -> new ResourceNotFoundException("Pasta não encontrada"));
        contentAccess.requireCollectionWrite(userId, workspace, collection == null ? null : collection.getId());

        var item = new WorkspaceItem();
        item.setWorkspace(workspace);
        item.setCollection(collection);
        item.setType(request.type());
        item.setTitle(request.title());
        item.setDescription(normalizeDescription(request.description()));
        item.setTextContent(request.textContent());
        item.setLinkUrl(request.linkUrl());
        try {
            itemRepository.saveAndFlush(item);
            if ("secret".equals(request.type())) {
                var secret = new WorkspaceItemSecret();
                secret.setItemId(item.getId());
                secret.setValue(secretCipher.encrypt(request.value()));
                secretRepository.saveAndFlush(secret);
            }
            activityLogService.record(workspaceId, userId, ActivityActorContext.USER, ActivityAction.ITEM_CREATED,
                    ActivityResourceType.ITEM, item.getId(),
                    Map.of("type", item.getType(), "title", item.getTitle()));
            return toResponse(item, true);
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, DUPLICATE_TITLE_CONSTRAINT)) {
                throw new ConflictException("Título indisponível nesta localização");
            }
            throw exception;
        }
    }

    @Transactional
    public ItemPageResponse list(UUID userId, UUID workspaceId, UUID collectionId, boolean archived,
                                 int page, int size) {
        lockWorkspace(workspaceId);
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "read");
        validatePage(page, size);
        if (collectionId != null && collectionRepository.findByIdAndWorkspaceId(collectionId, workspaceId).isEmpty()) {
            throw new ResourceNotFoundException("Pasta não encontrada");
        }
        if (collectionId != null) contentAccess.requireCollection(userId, workspace, collectionId);
        var pageable = PageRequest.of(page, size);
        boolean includeSecrets = true;
        return ItemPageResponse.from(itemRepository.listAccessible(workspaceId, userId, collectionId, includeSecrets, archived, pageable)
                .map(item -> toResponse(item, false)));
    }

    @Transactional
    public ItemPageResponse search(UUID userId, UUID workspaceId, String query, boolean includeArchived,
                                   int page, int size) {
        lockWorkspace(workspaceId);
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "read");
        validatePage(page, size);
        if (query == null || query.isBlank() || query.trim().length() > 255) {
            throw new ValidationException("Busca deve conter entre 1 e 255 caracteres");
        }
        var pageable = PageRequest.of(page, size);
        boolean includeSecrets = true;
        return ItemPageResponse.from(itemRepository.searchAccessible(
                        workspaceId, userId, query.trim(), includeSecrets, includeArchived, pageable)
                .map(item -> toAccessibleResponse(userId, workspace, item, false)));
    }

    @Transactional
    public ItemResponse get(UUID userId, UUID workspaceId, UUID itemId) {
        lockWorkspace(workspaceId);
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "read");
        var item = itemRepository.findIncludingArchived(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        contentAccess.requireItem(userId, workspace, itemId);
        return toAccessibleResponse(userId, workspace, item, true);
    }

    @Transactional
    public SecretValueResponse reveal(UUID userId, UUID workspaceId, UUID itemId) {
        lockWorkspace(workspaceId);
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "read");
        var item = itemRepository.findIncludingArchived(itemId, workspaceId)
                .filter(found -> "secret".equals(found.getType()))
                .orElseThrow(() -> new ResourceNotFoundException("Segredo não encontrado"));
        contentAccess.requireItem(userId, workspace, itemId);
        var secret = secretRepository.findById(item.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Segredo não encontrado"));
        return new SecretValueResponse(secretCipher.decrypt(secret.getValue()));
    }

    @Transactional
    public void delete(UUID userId, UUID workspaceId, UUID itemId, boolean confirm) {
        lockWorkspace(workspaceId);
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "delete");
        if (!confirm) {
            throw new ValidationException("Confirmação explícita obrigatória para excluir o item");
        }
        var item = itemRepository.findAnyForUpdate(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        contentAccess.requireItem(userId, workspace, itemId);
        contentAccess.requireCollectionWrite(userId, workspace,
                item.getCollection() == null ? null : item.getCollection().getId());
        if (item.getArchivedAt() == null) {
            throw new ConflictException("Somente itens arquivados podem ser excluídos definitivamente");
        }
        if ("file".equals(item.getType()) || "image".equals(item.getType())) {
            attachmentService.deleteObjectAfterCommit(itemId);
        }
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER, ActivityAction.ITEM_DELETED,
                ActivityResourceType.ITEM, itemId, Map.of("type", item.getType(), "title", item.getTitle()));
        itemRepository.delete(item);
        itemRepository.flush();
    }

    @Transactional
    public void restore(UUID userId, UUID workspaceId, UUID itemId) {
        lockWorkspace(workspaceId);
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "update");
        var item = itemRepository.findAnyForUpdate(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        contentAccess.requireItem(userId, workspace, itemId);
        contentAccess.requireCollectionWrite(userId, workspace,
                item.getCollection() == null ? null : item.getCollection().getId());
        if (item.getArchivedAt() == null) {
            throw new ConflictException("Item não está arquivado");
        }
        item.setArchivedAt(null);
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER, ActivityAction.ITEM_RESTORED,
                ActivityResourceType.ITEM, itemId, Map.of("type", item.getType(), "title", item.getTitle()));
    }

    @Transactional
    public void archive(UUID userId, UUID workspaceId, UUID itemId) {
        lockWorkspace(workspaceId);
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "update");
        var item = itemRepository.findAnyForUpdate(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        contentAccess.requireItem(userId, workspace, itemId);
        contentAccess.requireCollectionWrite(userId, workspace,
                item.getCollection() == null ? null : item.getCollection().getId());
        if (item.getArchivedAt() != null) {
            throw new ConflictException("Item já arquivado");
        }
        item.setArchivedAt(OffsetDateTime.now());
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER, ActivityAction.ITEM_ARCHIVED,
                ActivityResourceType.ITEM, itemId, Map.of("type", item.getType(), "title", item.getTitle()));
    }

    @Transactional
    public ItemResponse update(UUID userId, UUID workspaceId, UUID itemId, UpdateItemRequest request) {
        lockWorkspace(workspaceId);
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "update");
        var item = itemRepository.findActiveForUpdate(itemId, workspaceId)
                .filter(found -> "text".equals(found.getType()) || "link".equals(found.getType())
                        || "secret".equals(found.getType()))
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        contentAccess.requireItem(userId, workspace, itemId);
        contentAccess.requireCollectionWrite(userId, workspace,
                item.getCollection() == null ? null : item.getCollection().getId());
        validateContent(item.getType(), request.textContent(), request.linkUrl(), request.value());

        var before = itemSnapshot(item, false);
        try {
            item.setTitle(request.title());
            switch (item.getType()) {
                case "text" -> item.setTextContent(request.textContent());
                case "link" -> item.setLinkUrl(request.linkUrl());
                case "secret" -> {
                    var secret = secretRepository.findById(itemId)
                            .orElseThrow(() -> new ResourceNotFoundException("Segredo não encontrado"));
                    secret.setValue(secretCipher.encrypt(request.value()));
                    secretRepository.saveAndFlush(secret);
                }
                default -> throw new IllegalStateException("Tipo de item inválido para edição");
            }
            itemRepository.saveAndFlush(item);
            activityLogService.record(workspaceId, userId, ActivityActorContext.USER, ActivityAction.ITEM_UPDATED,
                    ActivityResourceType.ITEM, itemId,
                    Map.of("before", before, "after", itemSnapshot(item, true)));
            return toAccessibleResponse(userId, workspace, item, true);
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, DUPLICATE_TITLE_CONSTRAINT)) {
                throw new ConflictException("Título indisponível nesta localização");
            }
            throw exception;
        }
    }

    private void validateContent(String type, String textContent, String linkUrl, String value) {
        boolean valid = switch (type) {
            case "text" -> textContent != null && !textContent.isBlank() && linkUrl == null && value == null;
            case "link" -> textContent == null && value == null && linkUrl != null && isHttpUrl(linkUrl);
            case "secret" -> textContent == null && linkUrl == null && value != null && !value.isBlank();
            default -> throw new ValidationException("Tipo de item inválido para esta entrega");
        };
        if (!valid) {
            throw new ValidationException("Conteúdo inválido para o tipo de item");
        }
    }

    private Map<String, Object> itemSnapshot(WorkspaceItem item, boolean after) {
        var snapshot = new LinkedHashMap<String, Object>();
        snapshot.put("type", item.getType());
        snapshot.put("title", item.getTitle());
        if ("text".equals(item.getType()) || "link".equals(item.getType()) || "secret".equals(item.getType())) {
            snapshot.put("contentChanged", after);
        }
        return snapshot;
    }

    private void validateContent(CreateItemRequest request) {
        if (request.type() == null) {
            throw new ValidationException("Tipo de item inválido para esta entrega");
        }
        validateContent(request.type(), request.textContent(), request.linkUrl(), request.value());
    }

    private String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }
        String normalized = description.trim();
        return normalized.isBlank() ? null : normalized;
    }

    private boolean isHttpUrl(String value) {
        try {
            URI uri = new URI(value).parseServerAuthority();
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getPort() >= -1 && uri.getPort() <= 65535;
        } catch (URISyntaxException exception) {
            return false;
        }
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE || (long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException("Página ou tamanho inválido");
        }
    }

    private ItemResponse toResponse(WorkspaceItem item, boolean includeContent) {
        String preview = switch (item.getType()) {
            case "text" -> truncate(item.getTextContent());
            case "link" -> truncate(item.getLinkUrl());
            case "secret" -> null;
            default -> null;
        };
        return new ItemResponse(item.getId(), item.getType(), item.getTitle(),
                item.getCollection() == null ? null : item.getCollection().getId(),
                includeContent ? item.getTextContent() : null,
                includeContent ? item.getLinkUrl() : null, preview, item.getDescription(),
                item.getArchivedAt());
    }

    private ItemResponse toAccessibleResponse(UUID userId, Workspace workspace, WorkspaceItem item,
                                              boolean includeContent) {
        var response = toResponse(item, includeContent);
        return item.getCollection() != null
                && !contentAccess.canReadCollection(userId, workspace, item.getCollection().getId())
                ? new ItemResponse(response.id(), response.type(), response.title(), null,
                        response.textContent(), response.linkUrl(), response.preview(), response.description(),
                        response.archivedAt())
                : response;
    }

    private String truncate(String value) {
        if (value == null || value.length() <= MAX_PREVIEW_LENGTH) {
            return value;
        }
        return value.substring(0, MAX_PREVIEW_LENGTH - 1) + "…";
    }

    private void lockWorkspace(UUID workspaceId) {
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.flush();
        entityManager.clear();
    }

}
