package com.vaulty.api.controller;

import com.vaulty.api.controller.docs.WorkspaceItemControllerDocs;
import com.vaulty.api.dto.item.AttachmentResponse;
import com.vaulty.api.dto.item.CreateItemRequest;
import com.vaulty.api.dto.item.ItemPageResponse;
import com.vaulty.api.dto.item.ItemResponse;
import com.vaulty.api.dto.item.SecretValueResponse;
import com.vaulty.api.dto.item.UpdateItemMetadataRequest;
import com.vaulty.api.dto.item.UpdateItemRequest;
import com.vaulty.api.service.AttachmentDownload;
import com.vaulty.api.service.WorkspaceItemAttachmentService;
import com.vaulty.api.service.WorkspaceItemService;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/workspaces/{workspaceId}/items")
@RequiredArgsConstructor
public class WorkspaceItemController implements WorkspaceItemControllerDocs {

    private final WorkspaceItemService itemService;
    private final WorkspaceItemAttachmentService attachmentService;

    @PostMapping(value = "/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentResponse> createAttachment(@AuthenticationPrincipal UUID userId,
                                                               @PathVariable UUID workspaceId,
                                                               @RequestParam String title,
                                                               @RequestParam(required = false) String description,
                                                               @RequestParam(required = false) UUID collectionId,
                                                               @RequestParam MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(attachmentService.create(userId, workspaceId, title, description, collectionId, file));
    }

    @PutMapping(value = "/{itemId}/attachment", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentResponse> replaceAttachment(@AuthenticationPrincipal UUID userId,
                                                                @PathVariable UUID workspaceId,
                                                                @PathVariable UUID itemId,
                                                                @RequestParam MultipartFile file) {
        return ResponseEntity.ok(attachmentService.replace(userId, workspaceId, itemId, file));
    }

    @PutMapping("/{itemId}/metadata")
    public ResponseEntity<Void> updateAttachmentMetadata(@AuthenticationPrincipal UUID userId,
                                                         @PathVariable UUID workspaceId,
                                                         @PathVariable UUID itemId,
                                                         @Valid @RequestBody UpdateItemMetadataRequest request) {
        attachmentService.updateMetadata(userId, workspaceId, itemId, request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{itemId}/archive")
    public ResponseEntity<Void> archive(@AuthenticationPrincipal UUID userId,
                                        @PathVariable UUID workspaceId,
                                        @PathVariable UUID itemId) {
        itemService.archive(userId, workspaceId, itemId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{itemId}")
    public ResponseEntity<ItemResponse> update(@AuthenticationPrincipal UUID userId,
                                               @PathVariable UUID workspaceId,
                                               @PathVariable UUID itemId,
                                               @Valid @RequestBody UpdateItemRequest request) {
        return ResponseEntity.ok(itemService.update(userId, workspaceId, itemId, request));
    }

    @GetMapping("/{itemId}/attachment")
    public ResponseEntity<byte[]> downloadAttachment(@AuthenticationPrincipal UUID userId,
                                                     @PathVariable UUID workspaceId,
                                                     @PathVariable UUID itemId,
                                                     @RequestParam(defaultValue = "false") boolean download) {
        AttachmentDownload attachment = attachmentService.download(userId, workspaceId, itemId);
        ContentDisposition disposition = attachment.previewable() && !download
                ? ContentDisposition.inline().filename(attachment.fileName(), StandardCharsets.UTF_8).build()
                : ContentDisposition.attachment().filename(attachment.fileName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.mimeType()))
                .contentLength(attachment.content().length)
                .header("Content-Disposition", disposition.toString())
                .cacheControl(CacheControl.noStore())
                .body(attachment.content());
    }

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

    @PostMapping("/{itemId}/restore")
    public ResponseEntity<Void> restore(@AuthenticationPrincipal UUID userId,
                                        @PathVariable UUID workspaceId,
                                        @PathVariable UUID itemId) {
        itemService.restore(userId, workspaceId, itemId);
        return ResponseEntity.noContent().build();
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

    @DeleteMapping("/{itemId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UUID userId,
                                       @PathVariable UUID workspaceId,
                                       @PathVariable UUID itemId,
                                       @RequestParam(defaultValue = "false") boolean confirm) {
        itemService.delete(userId, workspaceId, itemId, confirm);
        return ResponseEntity.noContent().build();
    }
}
