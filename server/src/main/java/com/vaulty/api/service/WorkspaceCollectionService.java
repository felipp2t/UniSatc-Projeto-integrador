package com.vaulty.api.service;

import com.vaulty.api.dto.collection.CollectionPathEntry;
import com.vaulty.api.dto.collection.CollectionPageResponse;
import com.vaulty.api.dto.collection.CollectionResponse;
import com.vaulty.api.dto.collection.CreateCollectionRequest;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceCollection;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ForbiddenException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.repository.CollectionPathProjection;
import com.vaulty.api.repository.WorkspaceCollectionRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
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
    private final WorkspaceMemberRepository workspaceMemberRepository;

    @Transactional
    public CollectionResponse create(UUID userId, UUID workspaceId, CreateCollectionRequest request) {
        var member = requireMember(userId, workspaceId);
        var workspace = member.getWorkspace();

        if (!workspace.getOwner().getId().equals(userId)) {
            throw new ForbiddenException("Apenas o dono do workspace pode criar pastas");
        }
        var parent = (request.parentId() == null)
                ? null
                : collectionRepository.findByIdAndWorkspaceId(request.parentId(), workspaceId)
                        .orElseThrow(() -> new ResourceNotFoundException("Pasta pai não encontrada"));

        boolean nameAlreadyExists = parent == null
                ? collectionRepository.existsByWorkspaceIdAndParentIsNullAndName(workspaceId, request.name())
                : collectionRepository.existsByWorkspaceIdAndParentIdAndName(
                        workspaceId, parent.getId(), request.name());
        if (nameAlreadyExists) {
            throw new ConflictException("Já existe uma pasta com esse nome neste nível");
        }
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

    @Transactional(readOnly = true)
    public CollectionPageResponse list(UUID userId, UUID workspaceId, UUID parentId, int page, int size) {
        requireMember(userId, workspaceId);
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ValidationException("Página deve ser maior ou igual a zero e tamanho deve estar entre 1 e 100");
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
        requireMember(userId, workspaceId);
        var path = collectionRepository.findPath(workspaceId, collectionId);
        if (path.isEmpty()) {
            throw new ResourceNotFoundException("Pasta não encontrada");
        }
        return path.stream().map(entry -> new CollectionPathEntry(entry.getId(), entry.getName())).toList();
    }

    private WorkspaceMember requireMember(UUID userId, UUID workspaceId) {
        return workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
    }

    private CollectionResponse toResponse(WorkspaceCollection collection) {
        return new CollectionResponse(
                collection.getId(),
                collection.getName(),
                collection.getParent() == null ? null : collection.getParent().getId());
    }

    private boolean isDuplicateNameViolation(Throwable exception) {
        var cause = exception;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException violation
                    && DUPLICATE_NAME_CONSTRAINT.equals(violation.getConstraintName())) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }
}
