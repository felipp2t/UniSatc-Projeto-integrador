package com.vaulty.api.controller;

import com.vaulty.api.controller.docs.WorkspaceItemControllerDocs;
import com.vaulty.api.dto.item.CreateItemRequest;
import com.vaulty.api.dto.item.ItemPageResponse;
import com.vaulty.api.dto.item.ItemResponse;
import com.vaulty.api.dto.item.SecretValueResponse;
import com.vaulty.api.service.WorkspaceItemService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/workspaces/{workspaceId}/items")
@RequiredArgsConstructor
public class WorkspaceItemController implements WorkspaceItemControllerDocs {

    private final WorkspaceItemService itemService;

    @PostMapping
    public ResponseEntity<ItemResponse> create(@AuthenticationPrincipal UUID userId,
                                               @PathVariable UUID workspaceId,
                                               @Valid @RequestBody CreateItemRequest request) {
        var item = itemService.create(userId, workspaceId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(item);
    }

    @GetMapping
    public ResponseEntity<ItemPageResponse> list(@AuthenticationPrincipal UUID userId,
                                                 @PathVariable UUID workspaceId,
                                                 @RequestParam(required = false) UUID collectionId,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size) {
        var items = itemService.list(userId, workspaceId, collectionId, page, size);
        return ResponseEntity.ok(items);
    }

    @GetMapping("/search")
    public ResponseEntity<ItemPageResponse> search(@AuthenticationPrincipal UUID userId,
                                                   @PathVariable UUID workspaceId,
                                                   @RequestParam String q,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        var items = itemService.search(userId, workspaceId, q, page, size);
        return ResponseEntity.ok(items);
    }

    @GetMapping("/{itemId}")
    public ResponseEntity<ItemResponse> get(@AuthenticationPrincipal UUID userId,
                                            @PathVariable UUID workspaceId,
                                            @PathVariable UUID itemId) {
        var  item = itemService.get(userId, workspaceId, itemId);
        return ResponseEntity.ok(item);
    }

    @GetMapping("/{itemId}/secret")
    public ResponseEntity<SecretValueResponse> reveal(@AuthenticationPrincipal UUID userId,
                                                      @PathVariable UUID workspaceId,
                                                      @PathVariable UUID itemId) {
        var  secretValue = itemService.reveal(userId, workspaceId, itemId);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(secretValue);
    }
}
