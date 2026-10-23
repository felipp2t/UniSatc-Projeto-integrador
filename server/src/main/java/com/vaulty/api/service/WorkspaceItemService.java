package com.vaulty.api.service;

import com.vaulty.api.dto.item.CreateItemRequest;
import com.vaulty.api.dto.item.ItemPageResponse;
import com.vaulty.api.dto.item.ItemResponse;
import com.vaulty.api.dto.item.SecretValueResponse;
import com.vaulty.api.dto.item.AttachmentResponse;
import com.vaulty.api.dto.item.UpdateItemRequest;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceItem;
import com.vaulty.api.entity.WorkspaceItemSecret;
import com.vaulty.api.entity.WorkspaceItemFile;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.repository.PersistenceConstraints;
import com.vaulty.api.repository.WorkspaceCollectionRepository;
import com.vaulty.api.repository.WorkspaceItemRepository;
import com.vaulty.api.repository.WorkspaceItemFileRepository;
import com.vaulty.api.repository.WorkspaceItemSecretRepository;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.UUID;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.stream.Collectors;
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
    private final WorkspaceItemFileRepository fileRepository;
    private final WorkspaceCollectionRepository collectionRepository;
    private final WorkspaceContentAuthorization authorization;
    private final SecretCipher secretCipher;
    private final AttachmentCleanupService attachmentCleanupService;

    @Transactional
    public ItemResponse create(UUID userId, UUID workspaceId, CreateItemRequest request) {
        Workspace workspace = authorization.requireWorkspace(userId, workspaceId);
        validateContent(request);
        var collection = request.collectionId() == null ? null
                : collectionRepository.findByIdAndWorkspaceId(request.collectionId(), workspaceId)
                        .orElseThrow(() -> new ResourceNotFoundException("Pasta não encontrada"));

        var item = new WorkspaceItem();
        item.setWorkspace(workspace);
        item.setCollection(collection);
        item.setType(request.type());
        item.setTitle(request.title());
        item.setDescription(request.description());
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
    public ItemPageResponse list(UUID userId, UUID workspaceId, UUID collectionId, boolean includeArchived,
                                 int page, int size) {
        authorization.requireWorkspace(userId, workspaceId);
        validatePage(page, size);
        if (collectionId != null && collectionRepository.findByIdAndWorkspaceId(collectionId, workspaceId).isEmpty()) {
            throw new ResourceNotFoundException("Pasta não encontrada");
        }
        var pageable = PageRequest.of(page, size, Sort.by("title").ascending().and(Sort.by("id").ascending()));
        var pageResult = itemRepository.list(workspaceId, collectionId, true, includeArchived, pageable);
        var files = filesFor(pageResult.getContent());
        return ItemPageResponse.from(pageResult.map(item -> toResponse(item, false, files.get(item.getId()))));
    }

    @Transactional(readOnly = true)
    public ItemPageResponse search(UUID userId, UUID workspaceId, String query, boolean includeArchived,
                                   int page, int size) {
        authorization.requireWorkspace(userId, workspaceId);
        validatePage(page, size);
        if (query == null || query.isBlank() || query.trim().length() > 255) {
            throw new ValidationException("Busca deve conter entre 1 e 255 caracteres");
        }
        var pageable = PageRequest.of(page, size);
        var pageResult = itemRepository.searchByTitle(workspaceId, query.trim(), true, includeArchived, pageable);
        var files = filesFor(pageResult.getContent());
        return ItemPageResponse.from(pageResult.map(item -> toResponse(item, false, files.get(item.getId()))));
    }

    @Transactional(readOnly = true)
    public ItemResponse get(UUID userId, UUID workspaceId, UUID itemId) {
        authorization.requireWorkspace(userId, workspaceId);
        var item = itemRepository.findByIdAndWorkspaceId(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        return toResponse(item, true);
    }

    @Transactional(readOnly = true)
    public SecretValueResponse reveal(UUID userId, UUID workspaceId, UUID itemId) {
        authorization.requireWorkspace(userId, workspaceId);
        var item = itemRepository.findByIdAndWorkspaceId(itemId, workspaceId)
                .filter(found -> "secret".equals(found.getType()))
                .orElseThrow(() -> new ResourceNotFoundException("Segredo não encontrado"));
        var secret = secretRepository.findById(item.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Segredo não encontrado"));
        return new SecretValueResponse(secretCipher.decrypt(secret.getValue()));
    }

    @Transactional
    public ItemResponse update(UUID userId, UUID workspaceId, UUID itemId, UpdateItemRequest request) {
        authorization.requireWorkspace(userId, workspaceId);
        var item = itemRepository.lockByIdAndWorkspaceId(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        if (item.getArchivedAt() != null) {
            throw new ConflictException("Restaure o item antes de editar");
        }
        switch (item.getType()) {
            case "text" -> {
                if (request.textContent() == null || request.textContent().isBlank()
                        || request.linkUrl() != null || request.value() != null) {
                    throw new ValidationException("Conteúdo inválido para o tipo de item");
                }
                item.setTextContent(request.textContent());
            }
            case "link" -> {
                if (request.linkUrl() == null || !isHttpUrl(request.linkUrl())
                        || request.textContent() != null || request.value() != null) {
                    throw new ValidationException("Conteúdo inválido para o tipo de item");
                }
                item.setLinkUrl(request.linkUrl());
            }
            case "secret" -> {
                if (request.textContent() != null || request.linkUrl() != null
                        || (request.value() != null && request.value().isBlank())) {
                    throw new ValidationException("Conteúdo inválido para o tipo de item");
                }
                if (request.value() != null) {
                    var secret = secretRepository.findById(itemId)
                            .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
                    secret.setValue(secretCipher.encrypt(request.value()));
                }
            }
            case "file", "image" -> {
                if (request.textContent() != null || request.linkUrl() != null || request.value() != null) {
                    throw new ValidationException("Conteúdo inválido para o tipo de item");
                }
            }
            default -> throw new ValidationException("Tipo de item inválido");
        }
        item.setTitle(request.title());
        item.setDescription(request.description());
        try {
            return toResponse(itemRepository.saveAndFlush(item), true);
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, DUPLICATE_TITLE_CONSTRAINT)) {
                throw new ConflictException("Título indisponível nesta localização");
            }
            throw exception;
        }
    }

    @Transactional
    public ItemResponse archive(UUID userId, UUID workspaceId, UUID itemId) {
        authorization.requireWorkspace(userId, workspaceId);
        var item = itemRepository.lockByIdAndWorkspaceId(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        if (item.getArchivedAt() != null) {
            throw new ConflictException("Item já arquivado");
        }
        item.setArchivedAt(OffsetDateTime.now());
        return toResponse(itemRepository.saveAndFlush(item), true);
    }

    @Transactional
    public ItemResponse restore(UUID userId, UUID workspaceId, UUID itemId) {
        authorization.requireWorkspace(userId, workspaceId);
        var item = itemRepository.lockByIdAndWorkspaceId(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        if (item.getArchivedAt() == null) {
            throw new ConflictException("Item não está arquivado");
        }
        item.setArchivedAt(null);
        return toResponse(itemRepository.saveAndFlush(item), true);
    }

    @Transactional
    public void delete(UUID userId, UUID workspaceId, UUID itemId, boolean confirmed) {
        authorization.requireWorkspace(userId, workspaceId);
        if (!confirmed) {
            throw new ValidationException("Confirme a exclusão definitiva");
        }
        var item = itemRepository.lockByIdAndWorkspaceId(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        if (item.getArchivedAt() == null) {
            throw new ConflictException("Arquive o item antes de excluir");
        }
        fileRepository.findById(itemId).ifPresent(file -> attachmentCleanupService.enqueue(file.getStorageKey()));
        itemRepository.delete(item);
        itemRepository.flush();
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
        return toResponse(item, includeContent, fileRepository.findById(item.getId()).orElse(null));
    }

    private Map<UUID, WorkspaceItemFile> filesFor(java.util.List<WorkspaceItem> items) {
        return fileRepository.findAllById(items.stream().map(WorkspaceItem::getId).toList()).stream()
                .collect(Collectors.toMap(WorkspaceItemFile::getItemId, file -> file));
    }

    private ItemResponse toResponse(WorkspaceItem item, boolean includeContent, WorkspaceItemFile file) {
        String preview = switch (item.getType()) {
            case "text" -> truncate(item.getTextContent());
            case "link" -> truncate(item.getLinkUrl());
            case "secret" -> null;
            default -> null;
        };
        AttachmentResponse attachment = file == null ? null
                : new AttachmentResponse(file.getOriginalName(), file.getMimeType(), file.getSizeBytes());
        return new ItemResponse(item.getId(), item.getType(), item.getTitle(),
                item.getCollection() == null ? null : item.getCollection().getId(),
                includeContent ? item.getTextContent() : null,
                includeContent ? item.getLinkUrl() : null, preview,
                item.getDescription(), item.getArchivedAt(), attachment);
    }

    private String truncate(String value) {
        if (value == null || value.length() <= MAX_PREVIEW_LENGTH) {
            return value;
        }
        return value.substring(0, MAX_PREVIEW_LENGTH - 1) + "…";
    }

}
