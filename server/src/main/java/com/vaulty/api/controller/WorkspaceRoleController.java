package com.vaulty.api.controller;

import com.vaulty.api.controller.docs.WorkspaceRoleControllerDocs;
import com.vaulty.api.dto.role.RoleRequest;
import com.vaulty.api.dto.role.RoleResponse;
import com.vaulty.api.dto.workspace.RolePermissionsRequest;
import com.vaulty.api.dto.workspace.RolePermissionsResponse;
import com.vaulty.api.dto.workspace.WorkspacePermission;
import com.vaulty.api.service.WorkspaceRoleService;
import com.vaulty.api.service.WorkspaceRolePermissionService;
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
@RequestMapping("/workspaces/{workspaceId}/roles")
@RequiredArgsConstructor
public class WorkspaceRoleController implements WorkspaceRoleControllerDocs {

    private final WorkspaceRoleService roleService;
    private final WorkspaceRolePermissionService permissionService;

    @GetMapping("/permissions/catalog")
    public ResponseEntity<List<WorkspacePermission>> catalog(@AuthenticationPrincipal UUID userId,
                                                               @PathVariable UUID workspaceId) {
        return ResponseEntity.ok(permissionService.catalog(userId, workspaceId));
    }

    @GetMapping
    public ResponseEntity<List<RoleResponse>> list(@AuthenticationPrincipal UUID userId,
                                                   @PathVariable UUID workspaceId) {
        return ResponseEntity.ok(roleService.list(userId, workspaceId));
    }

    @PostMapping
    public ResponseEntity<RoleResponse> create(@AuthenticationPrincipal UUID userId,
                                               @PathVariable UUID workspaceId,
                                               @Valid @RequestBody RoleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roleService.create(userId, workspaceId, request));
    }

    @GetMapping("/{roleId}/permissions")
    public ResponseEntity<List<WorkspacePermission>> permissions(@AuthenticationPrincipal UUID userId,
                                                                 @PathVariable UUID workspaceId,
                                                                 @PathVariable UUID roleId) {
        return ResponseEntity.ok(roleService.permissions(userId, workspaceId, roleId));
    }

    @DeleteMapping("/{roleId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UUID userId,
                                       @PathVariable UUID workspaceId,
                                       @PathVariable UUID roleId) {
        roleService.delete(userId, workspaceId, roleId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{roleId}/permissions")
    public ResponseEntity<RolePermissionsResponse> replacePermissions(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId,
            @PathVariable UUID roleId, @Valid @RequestBody RolePermissionsRequest request) {
        return ResponseEntity.ok(permissionService.replacePermissions(userId, workspaceId, roleId, request));
    }
}
