package com.vaulty.api.controller;

import com.vaulty.api.dto.item.ItemResponse;
import com.vaulty.api.dto.item.SecretValueResponse;
import com.vaulty.api.dto.sharing.ReceivedContentPage;
import com.vaulty.api.dto.sharing.ReceivedItemResponse;
import com.vaulty.api.service.ReceivedContentService;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/workspaces/{workspaceId}/received")
@RequiredArgsConstructor
public class WorkspaceReceivedContentController {

    private final ReceivedContentService receivedContent;

    @GetMapping
    public ResponseEntity<ReceivedContentPage> list(@AuthenticationPrincipal UUID userId,
            @PathVariable UUID workspaceId, @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean contentOnly,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(receivedContent.list(userId, workspaceId, q, contentOnly, page, size));
    }

    @GetMapping("/{virtualId}/path")
    public ResponseEntity<ReceivedItemResponse> path(@AuthenticationPrincipal UUID userId,
            @PathVariable UUID workspaceId, @PathVariable UUID virtualId) {
        return ResponseEntity.ok(receivedContent.path(userId, workspaceId, virtualId));
    }

    @GetMapping("/{virtualId}")
    public ResponseEntity<ItemResponse> read(@AuthenticationPrincipal UUID userId,
            @PathVariable UUID workspaceId, @PathVariable UUID virtualId) {
        return ResponseEntity.ok(receivedContent.read(userId, workspaceId, virtualId));
    }

    @GetMapping("/{virtualId}/secret")
    public ResponseEntity<SecretValueResponse> secret(@AuthenticationPrincipal UUID userId,
            @PathVariable UUID workspaceId, @PathVariable UUID virtualId) {
        return ResponseEntity.ok(receivedContent.secret(userId, workspaceId, virtualId));
    }

    @GetMapping("/{virtualId}/attachment")
    public ResponseEntity<byte[]> attachment(@AuthenticationPrincipal UUID userId,
            @PathVariable UUID workspaceId, @PathVariable UUID virtualId,
            @RequestParam(defaultValue = "false") boolean download) {
        var attachment = receivedContent.attachment(userId, workspaceId, virtualId);
        var disposition = attachment.previewable() && !download
                ? ContentDisposition.inline().filename(attachment.fileName(), StandardCharsets.UTF_8).build()
                : ContentDisposition.attachment().filename(attachment.fileName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(MediaType.parseMediaType(attachment.mimeType()))
                .contentLength(attachment.content().length)
                .body(attachment.content());
    }
}
