package com.vaulty.api.service;

import com.vaulty.api.dto.item.AttachmentResponse;
import com.vaulty.api.dto.item.UpdateItemMetadataRequest;
import com.vaulty.api.entity.WorkspaceItem;
import com.vaulty.api.entity.WorkspaceItemFile;
import com.vaulty.api.entity.WorkspaceItemMedia;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.StorageUnavailableException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.repository.PersistenceConstraints;
import com.vaulty.api.repository.WorkspaceCollectionRepository;
import com.vaulty.api.repository.WorkspaceItemFileRepository;
import com.vaulty.api.repository.WorkspaceItemMediaRepository;
import com.vaulty.api.repository.WorkspaceItemRepository;
import com.vaulty.api.storage.ObjectStorage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
@Slf4j
public class WorkspaceItemAttachmentService {

    private static final long MAX_FILE_SIZE = 20_000_000;
    private static final int MAX_IMAGE_WIDTH = 10_000;
    private static final int MAX_IMAGE_HEIGHT = 10_000;
    private static final long MAX_IMAGE_PIXELS = 40_000_000;
    private static final String DUPLICATE_TITLE_CONSTRAINT = "uq_item_workspace_collection_title";
    private static final Map<String, String> MIME_TYPES = Map.of(
            "pdf", "application/pdf",
            "txt", "text/plain",
            "md", "text/markdown",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "png", "image/png",
            "jpg", "image/jpeg",
            "jpeg", "image/jpeg");

    private final WorkspaceItemRepository itemRepository;
    private final WorkspaceItemFileRepository fileRepository;
    private final WorkspaceItemMediaRepository mediaRepository;
    private final WorkspaceCollectionRepository collectionRepository;
    private final WorkspaceContentAuthorization authorization;
    private final ObjectProvider<ObjectStorage> storageProvider;
    private final ActivityLogService activityLogService;

    @Transactional
    public AttachmentResponse create(UUID userId, UUID workspaceId, String title, String description,
                                    UUID collectionId, MultipartFile file) {
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "create");
        var upload = validate(file);
        var collection = collectionId == null ? null
                : collectionRepository.findByIdAndWorkspaceId(collectionId, workspaceId)
                        .orElseThrow(() -> new ResourceNotFoundException("Pasta não encontrada"));
        validateTitle(title);

        var item = new WorkspaceItem();
        item.setWorkspace(workspace);
        item.setCollection(collection);
        item.setTitle(title.trim());
        item.setDescription(normalizeDescription(description));
        item.setType(upload.image ? "image" : "file");
        var storedFile = file(upload);
        var media = upload.image ? media(upload) : null;
        try {
            requireStorage().put(upload.key, upload.content, upload.mimeType);
            itemRepository.saveAndFlush(item);
            storedFile.setItemId(item.getId());
            fileRepository.saveAndFlush(storedFile);
            if (media != null) {
                media.setItemId(item.getId());
                mediaRepository.saveAndFlush(media);
            }
            activityLogService.record(workspaceId, userId, ActivityActorContext.USER, ActivityAction.ITEM_CREATED,
                    ActivityResourceType.ITEM, item.getId(), itemSnapshot(item, storedFile));
            deleteUploadedOnRollback(upload.key);
            return response(item.getId(), storedFile, media);
        } catch (DataIntegrityViolationException exception) {
            deleteSafely(upload.key);
            if (PersistenceConstraints.causedBy(exception, DUPLICATE_TITLE_CONSTRAINT)) {
                throw new ConflictException("Título indisponível nesta localização");
            }
            throw exception;
        } catch (RuntimeException exception) {
            deleteSafely(upload.key);
            throw exception;
        }
    }

    @Transactional
    public AttachmentResponse replace(UUID userId, UUID workspaceId, UUID itemId, MultipartFile file) {
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "update");
        var item = attachmentItemForUpdate(workspaceId, itemId);
        var oldFile = fileRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Anexo não encontrado"));
        var upload = validate(file);
        var newFile = file(upload);
        var newMedia = upload.image ? media(upload) : null;
        String oldKey = oldFile.getStorageKey();
        var before = itemSnapshot(item, oldFile);

        try {
            requireStorage().put(upload.key, upload.content, upload.mimeType);
            item.setType(upload.image ? "image" : "file");
            itemRepository.saveAndFlush(item);
            newFile.setItemId(itemId);
            fileRepository.saveAndFlush(newFile);
            if (newMedia == null) {
                mediaRepository.deleteById(itemId);
                mediaRepository.flush();
            } else {
                newMedia.setItemId(itemId);
                mediaRepository.saveAndFlush(newMedia);
            }
            activityLogService.record(workspaceId, userId, ActivityActorContext.USER, ActivityAction.ITEM_UPDATED,
                    ActivityResourceType.ITEM, itemId,
                    Map.of("before", before, "after", itemSnapshot(item, newFile)));
            deleteUploadedOnRollback(upload.key);
            deleteOldAfterCommit(oldKey);
            return response(itemId, newFile, newMedia);
        } catch (RuntimeException exception) {
            deleteSafely(upload.key);
            throw exception;
        }
    }

    @Transactional
    public void updateMetadata(UUID userId, UUID workspaceId, UUID itemId, UpdateItemMetadataRequest request) {
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "update");
        var item = attachmentItemForUpdate(workspaceId, itemId);
        validateTitle(request.title());
        String description = normalizeDescription(request.description());
        var file = fileRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Anexo não encontrado"));
        var before = itemSnapshot(item, file);
        item.setTitle(request.title().trim());
        item.setDescription(description);
        try {
            itemRepository.saveAndFlush(item);
            activityLogService.record(workspaceId, userId, ActivityActorContext.USER, ActivityAction.ITEM_UPDATED,
                    ActivityResourceType.ITEM, itemId,
                    Map.of("before", before, "after", itemSnapshot(item, file)));
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, DUPLICATE_TITLE_CONSTRAINT)) {
                throw new ConflictException("Título indisponível nesta localização");
            }
            throw exception;
        }
    }

    @Transactional
    public AttachmentDownload download(UUID userId, UUID workspaceId, UUID itemId) {
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "item", "read");
        var item = attachmentItemForRead(workspaceId, itemId);
        var file = fileRepository.findById(item.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Anexo não encontrado"));
        return new AttachmentDownload(requireStorage().get(file.getStorageKey()), file.getOriginalName(), file.getMimeType(),
                "application/pdf".equals(file.getMimeType()) || file.getMimeType().startsWith("image/"));
    }

    public void deleteObjectAfterCommit(UUID itemId) {
        fileRepository.findById(itemId).ifPresent(file -> deleteOldAfterCommit(file.getStorageKey()));
    }

    private WorkspaceItem attachmentItemForRead(UUID workspaceId, UUID itemId) {
        return itemRepository.findForRead(itemId, workspaceId)
                .filter(item -> "file".equals(item.getType()) || "image".equals(item.getType()))
                .orElseThrow(() -> new ResourceNotFoundException("Anexo não encontrado"));
    }

    private WorkspaceItem attachmentItemForUpdate(UUID workspaceId, UUID itemId) {
        return itemRepository.findActiveForUpdate(itemId, workspaceId)
                .filter(item -> "file".equals(item.getType()) || "image".equals(item.getType()))
                .orElseThrow(() -> new ResourceNotFoundException("Anexo não encontrado"));
    }

    private Upload validate(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_FILE_SIZE) {
            throw new ValidationException("O arquivo deve conter de 1 a 20.000.000 bytes");
        }
        String fileName = safeFileName(file.getOriginalFilename());
        int dot = fileName.lastIndexOf('.');
        String format = dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (!MIME_TYPES.containsKey(format)) {
            throw new ValidationException("Formato de arquivo não permitido");
        }
        try {
            byte[] content = file.getBytes();
            if (content.length == 0 || content.length > MAX_FILE_SIZE) {
                throw new ValidationException("O arquivo deve conter de 1 a 20.000.000 bytes");
            }
            Integer width = null;
            Integer height = null;
            boolean image = format.equals("png") || format.equals("jpg") || format.equals("jpeg");
            if (image) {
                if (!hasExpectedImageSignature(content, format)) {
                    throw new ValidationException("A extensão não corresponde ao formato da imagem");
                }
                var dimensions = imageDimensions(content, format);
                width = dimensions.width;
                height = dimensions.height;
            } else if (format.equals("pdf") && !hasPdfSignature(content)) {
                throw new ValidationException("O conteúdo não corresponde ao formato PDF");
            } else if (isOfficeFormat(format) && !hasZipSignature(content)) {
                throw new ValidationException("O conteúdo não corresponde a um documento Office");
            }
            String mimeType = MIME_TYPES.get(format);
            return new Upload(UUID.randomUUID().toString(), fileName, format, mimeType, content, image, width, height);
        } catch (IOException exception) {
            throw new ValidationException("Não foi possível ler o arquivo enviado");
        }
    }

    private Dimensions imageDimensions(byte[] content, String expectedFormat) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(content))) {
            if (input == null) {
                throw new ValidationException("Imagem inválida ou não suportada");
            }
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw new ValidationException("Imagem inválida ou não suportada");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String detectedFormat = reader.getFormatName().toLowerCase(Locale.ROOT);
                boolean matchingFormat = expectedFormat.equals("png")
                        ? detectedFormat.equals("png")
                        : detectedFormat.equals("jpeg") || detectedFormat.equals("jpg");
                if (!matchingFormat) {
                    throw new ValidationException("A extensão não corresponde ao formato da imagem");
                }
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                long pixels = (long) width * height;
                if (width < 1 || height < 1 || width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT
                        || pixels > MAX_IMAGE_PIXELS) {
                    throw new ValidationException("Dimensões da imagem excedem o limite permitido");
                }
                return new Dimensions(width, height);
            } finally {
                reader.dispose();
            }
        }
    }

    private boolean hasPdfSignature(byte[] content) {
        return content.length >= 5 && content[0] == '%'
                && content[1] == 'P' && content[2] == 'D' && content[3] == 'F' && content[4] == '-';
    }

    private boolean isOfficeFormat(String format) {
        return format.equals("docx") || format.equals("xlsx") || format.equals("pptx");
    }

    private boolean hasZipSignature(byte[] content) {
        return content.length >= 4 && content[0] == 'P' && content[1] == 'K'
                && content[2] == 0x03 && content[3] == 0x04;
    }

    private String safeFileName(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            throw new ValidationException("Nome de arquivo obrigatório");
        }
        String fileName = originalName.replace('\\', '/');
        fileName = fileName.substring(fileName.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "_");
        if (fileName.isBlank() || fileName.length() > 255) {
            throw new ValidationException("Nome de arquivo inválido");
        }
        return fileName;
    }

    private boolean hasExpectedImageSignature(byte[] content, String format) {
        return switch (format) {
            case "png" -> content.length >= 8
                    && content[0] == (byte) 0x89 && content[1] == 0x50 && content[2] == 0x4e
                    && content[3] == 0x47 && content[4] == 0x0d && content[5] == 0x0a
                    && content[6] == 0x1a && content[7] == 0x0a;
            case "jpg", "jpeg" -> content.length >= 3
                    && content[0] == (byte) 0xff && content[1] == (byte) 0xd8 && content[2] == (byte) 0xff;
            default -> false;
        };
    }

    private void validateTitle(String title) {
        if (title == null || title.isBlank() || title.trim().length() > 255) {
            throw new ValidationException("Título deve conter entre 1 e 255 caracteres");
        }
    }

    private String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }
        String normalized = description.trim();
        if (normalized.length() > 2000) {
            throw new ValidationException("Descrição deve ter no máximo 2.000 caracteres");
        }
        return normalized.isBlank() ? null : normalized;
    }

    private WorkspaceItemFile file(Upload upload) {
        var file = new WorkspaceItemFile();
        file.setStorageKey(upload.key);
        file.setOriginalName(upload.fileName);
        file.setMimeType(upload.mimeType);
        file.setSizeBytes(upload.content.length);
        return file;
    }

    private WorkspaceItemMedia media(Upload upload) {
        var media = new WorkspaceItemMedia();
        media.setFormat(upload.format);
        media.setWidth(upload.width);
        media.setHeight(upload.height);
        return media;
    }

    private AttachmentResponse response(UUID itemId, WorkspaceItemFile file, WorkspaceItemMedia media) {
        String format = media == null
                ? file.getOriginalName().substring(file.getOriginalName().lastIndexOf('.') + 1).toLowerCase(Locale.ROOT)
                : media.getFormat();
        return new AttachmentResponse(itemId, file.getOriginalName(), file.getMimeType(), file.getSizeBytes(),
                format, media == null ? null : media.getWidth(), media == null ? null : media.getHeight());
    }

    private Map<String, Object> itemSnapshot(WorkspaceItem item, WorkspaceItemFile file) {
        var snapshot = new LinkedHashMap<String, Object>();
        snapshot.put("title", item.getTitle());
        snapshot.put("type", item.getType());
        snapshot.put("fileName", file.getOriginalName());
        snapshot.put("mimeType", file.getMimeType());
        snapshot.put("sizeBytes", file.getSizeBytes());
        return snapshot;
    }

    private void deleteUploadedOnRollback(String key) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    deleteSafely(key);
                }
            }
        });
    }

    private void deleteOldAfterCommit(String key) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteSafely(key);
            }
        });
    }

    private void deleteSafely(String key) {
        try {
            ObjectStorage storage = storageProvider.getIfAvailable();
            if (storage == null) {
                log.warn("Could not remove attachment object {} because storage is unavailable", key);
                return;
            }
            storage.delete(key);
        } catch (RuntimeException exception) {
            log.warn("Could not remove attachment object {}", key, exception);
        }
    }

    private ObjectStorage requireStorage() {
        ObjectStorage storage = storageProvider.getIfAvailable();
        if (storage == null) {
            throw new StorageUnavailableException();
        }
        return storage;
    }

    private record Upload(String key, String fileName, String format, String mimeType, byte[] content,
                          boolean image, Integer width, Integer height) {
    }

    private record Dimensions(int width, int height) {
    }
}
