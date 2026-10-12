package com.vaulty.api.service;

import com.vaulty.api.dto.item.CreateItemRequest;
import com.vaulty.api.dto.item.ItemPageResponse;
import com.vaulty.api.dto.item.ItemResponse;
import com.vaulty.api.dto.item.SecretValueResponse;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceItem;
import com.vaulty.api.entity.WorkspaceItemSecret;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.repository.WorkspaceCollectionRepository;
import com.vaulty.api.repository.WorkspaceItemRepository;
import com.vaulty.api.repository.WorkspaceItemSecretRepository;
import java.util.Set;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceItemService {

    private static final String DUPLICATE_TITLE_CONSTRAINT = "uq_item_workspace_collection_title";
    private static final Set<String> TYPES = Set.of("text", "link", "secret");
    private static final int MAX_PAGE_SIZE = 100;

    private final WorkspaceItemRepository itemRepository;
    private final WorkspaceItemSecretRepository secretRepository;
    private final WorkspaceCollectionRepository collectionRepository;
    private final WorkspaceContentAuthorization authorization;
    private final SecretCipher secretCipher;

    @Transactional
    public ItemResponse create(UUID userId, UUID workspaceId, CreateItemRequest request) {
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "create");
        validateContent(request);
        if ("secret".equals(request.type())) {
            authorization.require(userId, workspace, "secret", "create");
        }
        var collection = request.collectionId() == null ? null
                : collectionRepository.findByIdAndWorkspaceId(request.collectionId(), workspaceId)
                        .orElseThrow(() -> new ResourceNotFoundException("Pasta não encontrada"));

        var item = new WorkspaceItem();
        item.setWorkspace(workspace);
        item.setCollection(collection);
        item.setType(request.type());
        item.setTitle(request.title());
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
            return toResponse(item, true);
        } catch (DataIntegrityViolationException exception) {
            if (isDuplicateTitleViolation(exception)) {
                throw new ConflictException("Já existe um item com esse título neste nível");
            }
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public ItemPageResponse list(UUID userId, UUID workspaceId, UUID collectionId, int page, int size) {
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "read");
        validatePage(page, size);
        if (collectionId != null && collectionRepository.findByIdAndWorkspaceId(collectionId, workspaceId).isEmpty()) {
            throw new ResourceNotFoundException("Pasta não encontrada");
        }
        var pageable = PageRequest.of(page, size, Sort.by("title").ascending().and(Sort.by("id").ascending()));
        boolean includeSecrets = authorization.allows(userId, workspace, "secret", "read");
        return ItemPageResponse.from(itemRepository.list(workspaceId, collectionId, includeSecrets, pageable)
                .map(item -> toResponse(item, false)));
    }

    @Transactional(readOnly = true)
    public ItemPageResponse search(UUID userId, UUID workspaceId, String query, int page, int size) {
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "read");
        validatePage(page, size);
        if (query == null || query.isBlank() || query.trim().length() > 255) {
            throw new ValidationException("Busca deve conter entre 1 e 255 caracteres");
        }
        String term = query.trim().toLowerCase(Locale.ROOT);
        String escaped = term.replace("!", "!!").replace("%", "!%").replace("_", "!_");
        var pageable = PageRequest.of(page, size);
        boolean includeSecrets = authorization.allows(userId, workspace, "secret", "read");
        return ItemPageResponse.from(itemRepository.searchByTitle(
                        workspaceId, term, "%" + escaped + "%", escaped + "%", includeSecrets, pageable)
                .map(item -> toResponse(item, false)));
    }

    @Transactional(readOnly = true)
    public ItemResponse get(UUID userId, UUID workspaceId, UUID itemId) {
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "read");
        var item = itemRepository.findByIdAndWorkspaceIdAndArchivedAtIsNull(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item não encontrado"));
        if ("secret".equals(item.getType())) {
            authorization.require(userId, workspace, "secret", "read");
        }
        return toResponse(item, true);
    }

    @Transactional(readOnly = true)
    public SecretValueResponse reveal(UUID userId, UUID workspaceId, UUID itemId) {
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "read");
        authorization.require(userId, workspace, "secret", "read");
        var item = itemRepository.findByIdAndWorkspaceIdAndArchivedAtIsNull(itemId, workspaceId)
                .filter(found -> "secret".equals(found.getType()))
                .orElseThrow(() -> new ResourceNotFoundException("Segredo não encontrado"));
        var secret = secretRepository.findById(item.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Segredo não encontrado"));
        return new SecretValueResponse(secretCipher.decrypt(secret.getValue()));
    }

    private void validateContent(CreateItemRequest request) {
        if (request.type() == null || !TYPES.contains(request.type())) {
            throw new ValidationException("Tipo de item inválido para esta entrega");
        }
        boolean valid = switch (request.type()) {
            case "text" -> request.textContent() != null && request.linkUrl() == null && request.value() == null;
            case "link" -> request.textContent() == null && request.value() == null
                    && request.linkUrl() != null && request.linkUrl().length() <= 2048
                    && (request.linkUrl().startsWith("http://") || request.linkUrl().startsWith("https://"));
            case "secret" -> request.textContent() == null && request.linkUrl() == null
                    && request.value() != null && !request.value().isBlank();
            default -> false;
        };
        if (!valid) {
            throw new ValidationException("Conteúdo inválido para o tipo de item");
        }
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE || (long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException("Página ou tamanho inválido");
        }
    }

    private ItemResponse toResponse(WorkspaceItem item, boolean includeContent) {
        return new ItemResponse(item.getId(), item.getType(), item.getTitle(),
                item.getCollection() == null ? null : item.getCollection().getId(),
                includeContent ? item.getTextContent() : null,
                includeContent ? item.getLinkUrl() : null);
    }

    private boolean isDuplicateTitleViolation(Throwable exception) {
        var cause = exception;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException violation
                    && DUPLICATE_TITLE_CONSTRAINT.equals(violation.getConstraintName())) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }
}
