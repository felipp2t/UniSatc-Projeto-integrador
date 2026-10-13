package com.vaulty.api.controller;

import com.vaulty.api.controller.docs.WorkspaceCollectionControllerDocs;
import com.vaulty.api.dto.collection.CollectionPathEntry;
import com.vaulty.api.dto.collection.CollectionPageResponse;
import com.vaulty.api.dto.collection.CollectionResponse;
import com.vaulty.api.dto.collection.CreateCollectionRequest;
import com.vaulty.api.dto.collection.RenameCollectionRequest;
import com.vaulty.api.service.WorkspaceCollectionService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/workspaces/{workspaceId}/collections")
@RequiredArgsConstructor
public class WorkspaceCollectionController implements WorkspaceCollectionControllerDocs {

    private final WorkspaceCollectionService collectionService;

    @GetMapping
    public ResponseEntity<CollectionPageResponse> list(@AuthenticationPrincipal UUID userId,
                                                       @PathVariable UUID workspaceId,
                                                       @RequestParam(required = false) UUID parentId,
                                                       @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(collectionService.list(userId, workspaceId, parentId, page, size));
    }

    @GetMapping("/{collectionId}/path")
    public ResponseEntity<List<CollectionPathEntry>> path(@AuthenticationPrincipal UUID userId,
                                                          @PathVariable UUID workspaceId,
                                                          @PathVariable UUID collectionId) {
        return ResponseEntity.ok(collectionService.path(userId, workspaceId, collectionId));
    }

    @PostMapping
    public ResponseEntity<CollectionResponse> create(@AuthenticationPrincipal UUID userId,
                                                     @PathVariable UUID workspaceId,
                                                     @Valid @RequestBody CreateCollectionRequest request) {
        var collection = collectionService.create(userId, workspaceId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(collection);
    }

    @PutMapping("/{collectionId}")
    public ResponseEntity<CollectionResponse> rename(@AuthenticationPrincipal UUID userId,
                                                     @PathVariable UUID workspaceId,
                                                     @PathVariable UUID collectionId,
                                                     @Valid @RequestBody RenameCollectionRequest request) {
        return ResponseEntity.ok(collectionService.rename(userId, workspaceId, collectionId, request));
    }

    @DeleteMapping("/{collectionId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UUID userId,
                                       @PathVariable UUID workspaceId,
                                       @PathVariable UUID collectionId) {
        collectionService.delete(userId, workspaceId, collectionId);
        return ResponseEntity.noContent().build();
    }
}
