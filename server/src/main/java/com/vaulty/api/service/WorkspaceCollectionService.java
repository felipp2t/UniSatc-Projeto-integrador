package com.vaulty.api.service;

import com.vaulty.api.dto.collection.CollectionPathEntry;
import com.vaulty.api.dto.collection.CollectionPageResponse;
import com.vaulty.api.dto.collection.CollectionResponse;
import com.vaulty.api.dto.collection.CreateCollectionRequest;
import com.vaulty.api.dto.collection.RenameCollectionRequest;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceCollection;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.repository.WorkspaceCollectionRepository;
import com.vaulty.api.repository.WorkspaceItemRepository;
import java.util.List;
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
public class WorkspaceCollectionService {

    private static final String DUPLICATE_NAME_CONSTRAINT = "uq_collection_workspace_parent_name";
    private static final int MAX_PAGE_SIZE = 100;

    private final WorkspaceCollectionRepository collectionRepository;
    private final WorkspaceItemRepository itemRepository;
    private final WorkspaceContentAuthorization authorization;

    @Transactional
    public CollectionResponse create(UUID userId, UUID workspaceId, CreateCollectionRequest request) {
        var workspace = requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "collection", "create");
        var parent = (request.parentId() == null)
                ? null
                : collectionRepository.findByIdAndWorkspaceId(request.parentId(), workspaceId)
                        .orElseThrow(() -> new ResourceNotFoundException("Pasta pai não encontrada"));

        var collection = new WorkspaceCollection();
        collection.setWorkspace(workspace);
        collection.setParent(parent);
        collection.setName(request.name());

        try {
            return toResponse(collectionRepository.saveAndFlush(collection));
        } catch (DataIntegrityViolationException exception) {
            if (isDuplicateNameViolation(exception)) {
                throw new ConflictException("Já existe uma pasta com esse nome neste nível");
            }
            throw exception;
        }
    }

    @Transactional
    public CollectionResponse rename(UUID userId, UUID workspaceId, UUID collectionId,
                                     RenameCollectionRequest request) {
        var workspace = requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "collection", "update");
        var collection = collectionRepository.findByIdAndWorkspaceId(collectionId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Pasta não encontrada"));
        collection.setName(request.name());
        try {
            return toResponse(collectionRepository.saveAndFlush(collection));
        } catch (DataIntegrityViolationException exception) {
            if (isDuplicateNameViolation(exception)) {
                throw new ConflictException("Já existe uma pasta com esse nome neste nível");
            }
            throw exception;
        }
    }

    @Transactional
    public void delete(UUID userId, UUID workspaceId, UUID collectionId) {
        var workspace = requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "collection", "delete");
        var collection = collectionRepository.findByIdAndWorkspaceId(collectionId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Pasta não encontrada"));
        if (collectionRepository.existsByParentIdAndWorkspaceId(collectionId, workspaceId)
                || itemRepository.existsByCollectionIdAndWorkspaceId(collectionId, workspaceId)) {
            throw new ConflictException("Pasta não está vazia");
        }
        try {
            collectionRepository.delete(collection);
            collectionRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            if (hasConstraintViolation(exception, "fk_collection_parent_workspace")
                    || hasConstraintViolation(exception, "fk_item_collection_workspace")) {
                throw new ConflictException("Pasta não está vazia");
            }
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public CollectionPageResponse list(UUID userId, UUID workspaceId, UUID parentId, int page, int size) {
        var workspace = requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "collection", "read");
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE || (long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException(
                    "Página deve ser maior ou igual a zero, tamanho deve estar entre 1 e 100 "
                            + "e deslocamento não pode exceder " + Integer.MAX_VALUE);
        }

        var pageable = PageRequest.of(page, size, Sort.by("name").ascending().and(Sort.by("id").ascending()));
        if (parentId == null) {
            return CollectionPageResponse.from(collectionRepository
                    .findAllByWorkspaceIdAndParentIsNull(workspaceId, pageable)
                    .map(this::toResponse));
        }

        if (collectionRepository.findByIdAndWorkspaceId(parentId, workspaceId).isEmpty()) {
            throw new ResourceNotFoundException("Pasta não encontrada");
        }
        return CollectionPageResponse.from(collectionRepository
                .findAllByWorkspaceIdAndParentId(workspaceId, parentId, pageable)
                .map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public List<CollectionPathEntry> path(UUID userId, UUID workspaceId, UUID collectionId) {
        var workspace = requireWorkspace(userId, workspaceId);
        authorization.require(userId, workspace, "collection", "read");
        var path = collectionRepository.findPath(workspaceId, collectionId);
        if (path.isEmpty()) {
            throw new ResourceNotFoundException("Pasta não encontrada");
        }
        return path.stream().map(entry -> new CollectionPathEntry(entry.getId(), entry.getName())).toList();
    }

    private Workspace requireWorkspace(UUID userId, UUID workspaceId) {
        return authorization.requireWorkspace(userId, workspaceId);
    }

    private CollectionResponse toResponse(WorkspaceCollection collection) {
        return new CollectionResponse(
                collection.getId(),
                collection.getName(),
                collection.getParent() == null ? null : collection.getParent().getId());
    }

    private boolean isDuplicateNameViolation(Throwable exception) {
        return hasConstraintViolation(exception, DUPLICATE_NAME_CONSTRAINT);
    }

    private boolean hasConstraintViolation(Throwable exception, String constraintName) {
        var cause = exception;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException violation
                    && constraintName.equals(violation.getConstraintName())) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }
}
