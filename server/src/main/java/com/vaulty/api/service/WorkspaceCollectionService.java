package com.vaulty.api.service;

import com.vaulty.api.dto.collection.CollectionPathEntry;
import com.vaulty.api.dto.collection.CollectionPageResponse;
import com.vaulty.api.dto.collection.CollectionResponse;
import com.vaulty.api.dto.collection.CreateCollectionRequest;
import com.vaulty.api.dto.collection.RenameCollectionRequest;
import com.vaulty.api.entity.WorkspaceCollection;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.repository.PersistenceConstraints;
import com.vaulty.api.repository.WorkspaceCollectionRepository;
import com.vaulty.api.repository.WorkspaceItemRepository;
import com.vaulty.api.repository.WorkspaceTeamRepository;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceCollectionService {

    private static final String DUPLICATE_NAME_CONSTRAINT = "uq_collection_workspace_parent_name";
    private static final int MAX_PAGE_SIZE = 100;

    private final WorkspaceCollectionRepository collectionRepository;
    private final WorkspaceItemRepository itemRepository;
    private final WorkspaceTeamRepository teamRepository;
    private final WorkspaceContentAuthorization authorization;
    private final EffectiveContentAccess contentAccess;
    private final ActivityLogService activityLogService;
    private final WorkspaceItemAttachmentService attachmentService;
    private final WorkspaceAccessNotifications accessNotifications;
    private final EntityManager entityManager;

    @Transactional
    public CollectionResponse create(UUID userId, UUID workspaceId, CreateCollectionRequest request) {
        lockWorkspace(workspaceId);
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        var parent = (request.parentId() == null)
                ? null
                : collectionRepository.findByIdAndWorkspaceId(request.parentId(), workspaceId)
                        .orElseThrow(() -> new ResourceNotFoundException("Pasta pai não encontrada"));
        contentAccess.requireCollectionWrite(userId, workspace, parent == null ? null : parent.getId());

        var collection = new WorkspaceCollection();
        collection.setWorkspace(workspace);
        collection.setParent(parent);
        collection.setName(request.name());
        collection.setId(UUID.randomUUID());

        try {
            collection = collectionRepository.saveAndFlush(collection);
            activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                    ActivityAction.FOLDER_CREATED, ActivityResourceType.FOLDER, collection.getId(),
                    Map.of("name", collection.getName()));
            return toResponse(collection);
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, DUPLICATE_NAME_CONSTRAINT)) {
                throw new ConflictException("Já existe uma pasta com esse nome neste nível");
            }
            throw exception;
        }
    }

    @Transactional
    public CollectionResponse rename(UUID userId, UUID workspaceId, UUID collectionId,
                                     RenameCollectionRequest request) {
        lockWorkspace(workspaceId);
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        var collection = collectionRepository.findByIdAndWorkspaceId(collectionId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Pasta não encontrada"));
        contentAccess.requireCollectionWrite(userId, workspace, collectionId);
        String previousName = collection.getName();
        collection.setName(request.name());
        try {
            collection = collectionRepository.saveAndFlush(collection);
            activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                    ActivityAction.FOLDER_RENAMED, ActivityResourceType.FOLDER, collection.getId(),
                    Map.of("previousName", previousName, "name", collection.getName()));
            return toResponse(collection);
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, DUPLICATE_NAME_CONSTRAINT)) {
                throw new ConflictException("Já existe uma pasta com esse nome neste nível");
            }
            throw exception;
        }
    }

    @Transactional
    public void delete(UUID userId, UUID workspaceId, UUID collectionId) {
        lockWorkspace(workspaceId);
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        var collection = collectionRepository.findByIdAndWorkspaceIdForUpdate(collectionId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Pasta não encontrada"));
        contentAccess.requireCollectionWrite(userId, workspace, collectionId);
        if (teamRepository.existsByWorkspaceIdAndRootCollectionId(workspaceId, collectionId)) {
            throw new ConflictException("Coleção vinculada a um time não pode ser excluída diretamente");
        }
        var subtree = collectionRepository.findSubtreeForDelete(workspaceId, collectionId);
        var collectionIds = subtree.stream().map(WorkspaceCollection::getId).toList();
        var items = itemRepository.findAllByWorkspaceIdAndCollectionIdIn(workspaceId, collectionIds);
        items.stream().filter(item -> "file".equals(item.getType()) || "image".equals(item.getType()))
                .forEach(item -> attachmentService.deleteObjectAfterCommit(item.getId()));
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.FOLDER_DELETED, ActivityResourceType.FOLDER, collectionId,
                Map.of("name", collection.getName()));
        try {
            itemRepository.deleteAll(items);
            itemRepository.flush();
            for (var descendant : subtree) {
                collectionRepository.delete(descendant);
                collectionRepository.flush();
            }
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, "fk_collection_parent_workspace",
                    "fk_item_collection_workspace", "fk_workspace_team_root_collection")) {
                throw new ConflictException("A coleção está vinculada a outro recurso");
            }
            throw exception;
        }
    }

    @Transactional
    public CollectionPageResponse list(UUID userId, UUID workspaceId, UUID parentId, int page, int size) {
        lockWorkspace(workspaceId);
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "collection", "read");
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE || (long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException(
                    "Página deve ser maior ou igual a zero, tamanho deve estar entre 1 e 100 "
                            + "e deslocamento não pode exceder " + Integer.MAX_VALUE);
        }

        var pageable = PageRequest.of(page, size);
        if (parentId == null) {
            return CollectionPageResponse.from(collectionRepository
                    .findAccessible(workspaceId, userId, null, pageable)
                    .map(this::toResponse));
        }

        if (collectionRepository.findByIdAndWorkspaceId(parentId, workspaceId).isEmpty()) {
            throw new ResourceNotFoundException("Pasta não encontrada");
        }
        contentAccess.requireCollection(userId, workspace, parentId);
        return CollectionPageResponse.from(collectionRepository
                .findAccessible(workspaceId, userId, parentId, pageable)
                .map(this::toResponse));
    }

    @Transactional
    public List<CollectionPathEntry> path(UUID userId, UUID workspaceId, UUID collectionId) {
        lockWorkspace(workspaceId);
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "collection", "read");
        var path = collectionRepository.findPath(workspaceId, collectionId);
        if (path.isEmpty()) {
            throw new ResourceNotFoundException("Pasta não encontrada");
        }
        contentAccess.requireCollection(userId, workspace, collectionId);
        return path.stream().map(entry -> new CollectionPathEntry(entry.getId(), entry.getName())).toList();
    }

    private void lockWorkspace(UUID workspaceId) {
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
    }

    private CollectionResponse toResponse(WorkspaceCollection collection) {
        return new CollectionResponse(
                collection.getId(),
                collection.getName(),
                collection.getParent() == null ? null : collection.getParent().getId());
    }

}
