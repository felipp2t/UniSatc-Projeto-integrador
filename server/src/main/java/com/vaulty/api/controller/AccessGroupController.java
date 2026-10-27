package com.vaulty.api.controller;

import com.vaulty.api.controller.docs.AccessGroupControllerDocs;
import com.vaulty.api.dto.accessgroup.AccessGroupMemberResponse;
import com.vaulty.api.dto.accessgroup.AccessGroupRequest;
import com.vaulty.api.dto.accessgroup.AccessGroupResponse;
import com.vaulty.api.service.AccessGroupService;
import jakarta.validation.Valid;
import java.util.List;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/workspaces/{workspaceId}/groups")
@RequiredArgsConstructor
public class AccessGroupController implements AccessGroupControllerDocs {

    private final AccessGroupService groupService;

    @GetMapping
    public ResponseEntity<List<AccessGroupResponse>> list(@AuthenticationPrincipal UUID userId,
                                                           @PathVariable UUID workspaceId) {
        return ResponseEntity.ok(groupService.list(userId, workspaceId));
    }

    @PostMapping
    public ResponseEntity<AccessGroupResponse> create(@AuthenticationPrincipal UUID userId,
                                                       @PathVariable UUID workspaceId,
                                                       @Valid @RequestBody AccessGroupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(groupService.create(userId, workspaceId, request));
    }

    @PutMapping("/{groupId}")
    public ResponseEntity<AccessGroupResponse> rename(@AuthenticationPrincipal UUID userId,
                                                      @PathVariable UUID workspaceId,
                                                      @PathVariable UUID groupId,
                                                      @Valid @RequestBody AccessGroupRequest request) {
        return ResponseEntity.ok(groupService.rename(userId, workspaceId, groupId, request));
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UUID userId,
                                       @PathVariable UUID workspaceId,
                                       @PathVariable UUID groupId) {
        groupService.delete(userId, workspaceId, groupId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/members")
    public ResponseEntity<List<AccessGroupMemberResponse>> listMembers(@AuthenticationPrincipal UUID userId,
                                                                       @PathVariable UUID workspaceId,
                                                                       @PathVariable UUID groupId) {
        return ResponseEntity.ok(groupService.listMembers(userId, workspaceId, groupId));
    }

    @PutMapping("/{groupId}/members/{workspaceMemberId}")
    public ResponseEntity<Void> addMember(@AuthenticationPrincipal UUID userId,
                                          @PathVariable UUID workspaceId,
                                          @PathVariable UUID groupId,
                                          @PathVariable UUID workspaceMemberId) {
        groupService.addMember(userId, workspaceId, groupId, workspaceMemberId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{groupId}/members/{workspaceMemberId}")
    public ResponseEntity<Void> removeMember(@AuthenticationPrincipal UUID userId,
                                             @PathVariable UUID workspaceId,
                                             @PathVariable UUID groupId,
                                             @PathVariable UUID workspaceMemberId) {
        groupService.removeMember(userId, workspaceId, groupId, workspaceMemberId);
        return ResponseEntity.noContent().build();
    }
}
