package com.vaulty.api.controller;

import com.vaulty.api.service.WorkspaceSharingService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/workspaces/{workspaceId}/sharing")
@RequiredArgsConstructor
public class WorkspaceSharingController {
    private final WorkspaceSharingService sharing;

    @PutMapping("/collections/{collectionId}/groups/{groupId}")
    public ResponseEntity<Void> grantGroup(@AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId,
                                           @PathVariable UUID collectionId, @PathVariable UUID groupId) {
        sharing.grantGroup(userId, workspaceId, collectionId, groupId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/collections/{collectionId}/groups/{groupId}")
    public ResponseEntity<Void> revokeGroup(@AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId,
                                            @PathVariable UUID collectionId, @PathVariable UUID groupId) {
        sharing.revokeGroup(userId, workspaceId, collectionId, groupId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/collections/{collectionId}/everyone")
    public ResponseEntity<Void> grantEveryone(@AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId,
                                              @PathVariable UUID collectionId) {
        sharing.grantEveryone(userId, workspaceId, collectionId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/collections/{collectionId}/everyone")
    public ResponseEntity<Void> revokeEveryone(@AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId,
                                               @PathVariable UUID collectionId) {
        sharing.revokeEveryone(userId, workspaceId, collectionId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/collections/{collectionId}/inheritance")
    public ResponseEntity<Void> setInheritance(@AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId,
                                               @PathVariable UUID collectionId, @RequestParam boolean enabled) {
        sharing.setInheritance(userId, workspaceId, collectionId, enabled);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/items/{itemId}/members/{memberId}")
    public ResponseEntity<Void> grantMember(@AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId,
                                            @PathVariable UUID itemId, @PathVariable UUID memberId) {
        sharing.grantMember(userId, workspaceId, itemId, memberId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/items/{itemId}/members/{memberId}")
    public ResponseEntity<Void> revokeMember(@AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId,
                                             @PathVariable UUID itemId, @PathVariable UUID memberId) {
        sharing.revokeMember(userId, workspaceId, itemId, memberId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/items/{itemId}/origins")
    public ResponseEntity<List<String>> origins(@AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId,
                                                @PathVariable UUID itemId) {
        return ResponseEntity.ok(sharing.origins(userId, workspaceId, itemId));
    }

    @GetMapping("/collections/{collectionId}/origins")
    public ResponseEntity<List<String>> collectionOrigins(@AuthenticationPrincipal UUID userId,
                                                          @PathVariable UUID workspaceId,
                                                          @PathVariable UUID collectionId) {
        return ResponseEntity.ok(sharing.collectionOrigins(userId, workspaceId, collectionId));
    }

    @PutMapping("/roles/{roleId}/manager")
    public ResponseEntity<Void> setRoleSharing(@AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId,
                                               @PathVariable UUID roleId, @RequestParam boolean enabled) {
        sharing.setRoleSharingPermission(userId, workspaceId, roleId, enabled);
        return ResponseEntity.noContent().build();
    }
}
