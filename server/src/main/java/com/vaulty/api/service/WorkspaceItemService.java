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
import com.vaulty.api.repository.PersistenceConstraints;
import com.vaulty.api.repository.WorkspaceCollectionRepository;
import com.vaulty.api.repository.WorkspaceItemRepository;
import com.vaulty.api.repository.WorkspaceItemSecretRepository;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
            if (PersistenceConstraints.causedBy(exception, DUPLICATE_TITLE_CONSTRAINT)) {
                throw new ConflictException("Título indisponível nesta localização");
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
        var pageable = PageRequest.of(page, size);
        boolean includeSecrets = authorization.allows(userId, workspace, "secret", "read");
        return ItemPageResponse.from(itemRepository.searchByTitle(
                        workspaceId, query.trim(), includeSecrets, pageable)
                .map(item -> toResponse(item, false)));
    }

    @Transactional(readOnly = true)
    public ItemResponse get(UUID userId, UUID workspaceId, UUID itemId) {
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "read");
        boolean includeSecrets = authorization.allows(userId, workspace, "secret", "read");
        var item = itemRepository.findByIdAndWorkspaceIdAndArchivedAtIsNull(itemId, workspaceId)
                .filter(found -> includeSecrets || !"secret".equals(found.getType()))
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
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
        if (request.type() == null) {
            throw new ValidationException("Tipo de item inválido para esta entrega");
        }
        boolean valid = switch (request.type()) {
            case "text" -> request.textContent() != null && !request.textContent().isBlank()
                    && request.linkUrl() == null && request.value() == null;
            case "link" -> request.textContent() == null && request.value() == null
                    && request.linkUrl() != null && isHttpUrl(request.linkUrl());
            case "secret" -> request.textContent() == null && request.linkUrl() == null
                    && request.value() != null && !request.value().isBlank();
            default -> throw new ValidationException("Tipo de item inválido para esta entrega");
        };
        if (!valid) {
            throw new ValidationException("Conteúdo inválido para o tipo de item");
        }
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
                includeContent ? item.getLinkUrl() : null, preview);
    }

    private String truncate(String value) {
        if (value == null || value.length() <= MAX_PREVIEW_LENGTH) {
            return value;
        }
        return value.substring(0, MAX_PREVIEW_LENGTH - 1) + "…";
    }

}
