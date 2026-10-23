package com.vaulty.api.service;

import com.vaulty.api.dto.item.CreateDocumentRequest;
import com.vaulty.api.dto.item.ItemResponse;
import com.vaulty.api.entity.WorkspaceItem;
import com.vaulty.api.entity.WorkspaceItemFile;
import com.vaulty.api.entity.WorkspaceItemMedia;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.repository.PersistenceConstraints;
import com.vaulty.api.repository.WorkspaceCollectionRepository;
import com.vaulty.api.repository.WorkspaceItemFileRepository;
import com.vaulty.api.repository.WorkspaceItemMediaRepository;
import com.vaulty.api.repository.WorkspaceItemRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class WorkspaceDocumentService {
    private final WorkspaceContentAuthorization authorization;
    private final WorkspaceCollectionRepository collectionRepository;
    private final WorkspaceItemRepository itemRepository;
    private final WorkspaceItemFileRepository fileRepository;
    private final WorkspaceItemMediaRepository mediaRepository;
    private final WorkspaceItemService itemService;
    private final AttachmentValidator validator;
    private final AttachmentStorage storage;
    private final AttachmentCleanupService cleanup;
    private final TransactionTemplate transactions;

    public ItemResponse create(UUID userId, UUID workspaceId, CreateDocumentRequest request, MultipartFile upload) {
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        var collection = request.collectionId() == null ? null
                : collectionRepository.findByIdAndWorkspaceId(request.collectionId(), workspaceId)
                        .orElseThrow(() -> new ResourceNotFoundException("Pasta não encontrada"));
        var file = validator.validate(upload);
        String key = newKey();
        try {
            storage.put(key, file.bytes(), file.mime());
        } catch (RuntimeException failure) {
            cleanupNewObject(key);
            throw failure;
        }
        UUID id;
        try {
            id = transactions.execute(status -> {
                var item = new WorkspaceItem();
                item.setWorkspace(workspace);
                item.setCollection(collection);
                item.setType(file.itemType());
                item.setTitle(request.title());
                item.setDescription(request.description());
                itemRepository.saveAndFlush(item);
                saveFile(item.getId(), key, file);
                return item.getId();
            });
        } catch (RuntimeException failure) {
            cleanupNewObject(key);
            if (failure instanceof DataIntegrityViolationException
                    && PersistenceConstraints.causedBy(failure, "uq_item_workspace_collection_title")) {
                throw new ConflictException("Título indisponível nesta localização");
            }
            throw failure;
        }
        return itemService.get(userId, workspaceId, id);
    }

    public ItemResponse replace(UUID userId, UUID workspaceId, UUID itemId, MultipartFile upload) {
        authorization.requireWorkspace(userId, workspaceId);
        var item = itemRepository.findByIdAndWorkspaceId(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        if (item.getArchivedAt() != null) {
            throw new ConflictException("Restaure o item antes de editar");
        }
        var file = validator.validate(upload);
        if (!file.itemType().equals(item.getType())) {
            throw new ValidationException("Substituição deve manter o tipo do item");
        }
        String key = newKey();
        try {
            storage.put(key, file.bytes(), file.mime());
        } catch (RuntimeException failure) {
            cleanupNewObject(key);
            throw failure;
        }
        try {
            transactions.executeWithoutResult(status -> {
                var locked = itemRepository.lockByIdAndWorkspaceId(itemId, workspaceId)
                        .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
                if (locked.getArchivedAt() != null) {
                    throw new ConflictException("Restaure o item antes de editar");
                }
                var existing = fileRepository.findById(itemId)
                        .orElseThrow(() -> new ResourceNotFoundException("Anexo não encontrado"));
                String oldKey = existing.getStorageKey();
                existing.setStorageKey(key);
                existing.setOriginalName(file.name());
                existing.setMimeType(file.mime());
                existing.setSizeBytes(file.bytes().length);
                fileRepository.saveAndFlush(existing);
                if ("image".equals(file.itemType())) {
                    var media = mediaRepository.findById(itemId).orElseGet(WorkspaceItemMedia::new);
                    media.setItemId(itemId);
                    media.setWidthPx(file.width());
                    media.setHeightPx(file.height());
                    media.setFormat(file.format());
                    mediaRepository.saveAndFlush(media);
                }
                cleanup.enqueue(oldKey);
            });
        } catch (RuntimeException failure) {
            cleanupNewObject(key);
            throw failure;
        }
        return itemService.get(userId, workspaceId, itemId);
    }

    public DownloadedAttachment download(UUID userId, UUID workspaceId, UUID itemId) {
        authorization.requireWorkspace(userId, workspaceId);
        var item = itemRepository.findByIdAndWorkspaceId(itemId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Item indisponível"));
        if (!"file".equals(item.getType()) && !"image".equals(item.getType())) {
            throw new ResourceNotFoundException("Anexo não encontrado");
        }
        var file = fileRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Anexo não encontrado"));
        return new DownloadedAttachment(file.getOriginalName(), file.getMimeType(), storage.get(file.getStorageKey()));
    }

    private void saveFile(UUID id, String key, AttachmentValidator.ValidatedAttachment file) {
        var row = new WorkspaceItemFile();
        row.setItemId(id);
        row.setStorageKey(key);
        row.setOriginalName(file.name());
        row.setMimeType(file.mime());
        row.setSizeBytes(file.bytes().length);
        fileRepository.saveAndFlush(row);
        if ("image".equals(file.itemType())) {
            var media = new WorkspaceItemMedia();
            media.setItemId(id);
            media.setWidthPx(file.width());
            media.setHeightPx(file.height());
            media.setFormat(file.format());
            mediaRepository.saveAndFlush(media);
        }
    }

    private void cleanupNewObject(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException failure) {
            cleanup.enqueue(key);
        }
    }

    private String newKey() {
        return "items/" + UUID.randomUUID();
    }

    public record DownloadedAttachment(String name, String mimeType, byte[] bytes) {
    }
}
