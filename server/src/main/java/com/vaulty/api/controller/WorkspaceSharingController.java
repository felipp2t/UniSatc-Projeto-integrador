package com.vaulty.api.controller;

import com.vaulty.api.dto.sharing.CreatePublicationRequest;
import com.vaulty.api.dto.sharing.PublicationConfiguration;
import com.vaulty.api.dto.sharing.PublicationResponse;
import com.vaulty.api.service.WorkspaceSharingService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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

@RestController
@RequestMapping("/workspaces/{workspaceId}/sharing")
@RequiredArgsConstructor
public class WorkspaceSharingController {

    private final WorkspaceSharingService sharing;
    @PostMapping("/publications")
    public ResponseEntity<PublicationResponse> publish(@AuthenticationPrincipal UUID userId,
            @PathVariable UUID workspaceId, @Valid @RequestBody CreatePublicationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sharing.publish(userId, workspaceId, request));
    }

    @DeleteMapping("/publications/{publicationId}")
    public ResponseEntity<Void> revoke(@AuthenticationPrincipal UUID userId,
            @PathVariable UUID workspaceId, @PathVariable UUID publicationId) {
        sharing.revoke(userId, workspaceId, publicationId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/publications/configuration")
    public ResponseEntity<PublicationConfiguration> configuration(@AuthenticationPrincipal UUID userId,
            @PathVariable UUID workspaceId, @RequestParam UUID sourceCollectionId) {
        return ResponseEntity.ok(sharing.configuration(userId, workspaceId, sourceCollectionId));
    }

    // Legacy ACL, inheritance, grant and origin APIs are intentionally retired.
    @GetMapping({"/collections/{id}/configuration", "/items/{id}/configuration",
            "/items/{id}/origins", "/collections/{id}/origins"})
    public ResponseEntity<Void> retiredReadApi() {
        return ResponseEntity.status(HttpStatus.GONE).build();
    }

    @PutMapping({"/collections/{collectionId}/groups/{groupId}", "/collections/{collectionId}/everyone",
            "/collections/{collectionId}/inheritance", "/items/{itemId}/members/{memberId}",
            "/roles/{roleId}/manager"})
    public ResponseEntity<Void> retiredWriteApi() {
        return ResponseEntity.status(HttpStatus.GONE).build();
    }

    @DeleteMapping({"/collections/{collectionId}/groups/{groupId}", "/collections/{collectionId}/everyone",
            "/collections/{collectionId}/inheritance", "/items/{itemId}/members/{memberId}",
            "/roles/{roleId}/manager", "/items/{itemId}/acl", "/collections/{collectionId}/acl"})
    public ResponseEntity<Void> retiredDeleteApi() {
        return ResponseEntity.status(HttpStatus.GONE).build();
    }
}
