package com.vaulty.api.controller;

import com.vaulty.api.controller.docs.WorkspaceItemControllerDocs;
import com.vaulty.api.dto.item.CreateItemRequest;
import com.vaulty.api.dto.item.CreateDocumentRequest;
import com.vaulty.api.dto.item.ItemPageResponse;
import com.vaulty.api.dto.item.ItemResponse;
import com.vaulty.api.dto.item.SecretValueResponse;
import com.vaulty.api.dto.item.UpdateItemRequest;
import com.vaulty.api.service.WorkspaceItemService;
import com.vaulty.api.service.WorkspaceDocumentService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/workspaces/{workspaceId}/items")
@RequiredArgsConstructor
public class WorkspaceItemController implements WorkspaceItemControllerDocs {

    private final WorkspaceItemService itemService;
    private final WorkspaceDocumentService documentService;

    @PostMapping
    public ResponseEntity<ItemResponse> create(@AuthenticationPrincipal UUID userId,
                                               @PathVariable UUID workspaceId,
                                               @Valid @RequestBody CreateItemRequest request) {
        var item = itemService.create(userId, workspaceId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(item);
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ItemResponse> createDocument(@AuthenticationPrincipal UUID userId,
                                                        @PathVariable UUID workspaceId,
                                                        @Valid @RequestPart("metadata") CreateDocumentRequest metadata,
                                                        @RequestPart("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(documentService.create(userId, workspaceId, metadata, file));
    }

    @GetMapping
    public ResponseEntity<ItemPageResponse> list(@AuthenticationPrincipal UUID userId,
                                                 @PathVariable UUID workspaceId,
                                                 @RequestParam(required = false) UUID collectionId,
                                                 @RequestParam(defaultValue = "false") boolean includeArchived,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size) {
        var items = itemService.list(userId, workspaceId, collectionId, includeArchived, page, size);
        return ResponseEntity.ok(items);
    }

    @GetMapping("/search")
    public ResponseEntity<ItemPageResponse> search(@AuthenticationPrincipal UUID userId,
                                                   @PathVariable UUID workspaceId,
                                                   @RequestParam String q,
                                                   @RequestParam(defaultValue = "false") boolean includeArchived,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        var items = itemService.search(userId, workspaceId, q, includeArchived, page, size);
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

    @PutMapping("/{itemId}")
    public ResponseEntity<ItemResponse> update(@AuthenticationPrincipal UUID userId,
                                               @PathVariable UUID workspaceId,
                                               @PathVariable UUID itemId,
                                               @Valid @RequestBody UpdateItemRequest request) {
        return ResponseEntity.ok(itemService.update(userId, workspaceId, itemId, request));
    }

    @PostMapping("/{itemId}/archive")
    public ResponseEntity<ItemResponse> archive(@AuthenticationPrincipal UUID userId,
                                                @PathVariable UUID workspaceId,
                                                @PathVariable UUID itemId) {
        return ResponseEntity.ok(itemService.archive(userId, workspaceId, itemId));
    }

    @PostMapping("/{itemId}/restore")
    public ResponseEntity<ItemResponse> restore(@AuthenticationPrincipal UUID userId,
                                                @PathVariable UUID workspaceId,
                                                @PathVariable UUID itemId) {
        return ResponseEntity.ok(itemService.restore(userId, workspaceId, itemId));
    }

    @DeleteMapping("/{itemId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UUID userId,
                                       @PathVariable UUID workspaceId,
                                       @PathVariable UUID itemId,
                                       @RequestParam(defaultValue = "false") boolean confirm) {
        itemService.delete(userId, workspaceId, itemId, confirm);
        return ResponseEntity.noContent().build();
    }

    @PutMapping(value = "/{itemId}/attachment", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ItemResponse> replaceAttachment(@AuthenticationPrincipal UUID userId,
                                                           @PathVariable UUID workspaceId,
                                                           @PathVariable UUID itemId,
                                                           @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(documentService.replace(userId, workspaceId, itemId, file));
    }

    @GetMapping("/{itemId}/attachment")
    public ResponseEntity<byte[]> downloadAttachment(@AuthenticationPrincipal UUID userId,
                                                      @PathVariable UUID workspaceId,
                                                      @PathVariable UUID itemId,
                                                      @RequestParam(defaultValue = "false") boolean download) {
        var attachment = documentService.download(userId, workspaceId, itemId);
        boolean inline = !download && ("application/pdf".equals(attachment.mimeType())
                || "image/png".equals(attachment.mimeType()) || "image/jpeg".equals(attachment.mimeType()));
        var disposition = (inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(attachment.name(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(attachment.mimeType()))
                .body(attachment.bytes());
    }
}
