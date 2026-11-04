package com.vaulty.api.controller;

import com.vaulty.api.dto.admin.AdminInviteRequest;
import com.vaulty.api.dto.admin.AdminInviteResponse;
import com.vaulty.api.dto.admin.AdminWorkspaceDetailResponse;
import com.vaulty.api.dto.admin.AdminWorkspaceResponse;
import com.vaulty.api.dto.workspace.CreateWorkspaceRequest;
import com.vaulty.api.dto.workspace.UpdateWorkspaceRequest;
import com.vaulty.api.service.AdminWorkspaceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/workspaces")
@RequiredArgsConstructor
@Tag(name = "Administração", description = "Gestão de workspaces pelo administrador geral")
public class AdminWorkspaceController {

    private final AdminWorkspaceService adminWorkspaceService;

    @GetMapping
    @Operation(summary = "Lista todos os workspaces com dono, membros e convites pendentes")
    public List<AdminWorkspaceResponse> list(@AuthenticationPrincipal UUID adminId) {
        return adminWorkspaceService.list(adminId);
    }

    @PostMapping
    @Operation(summary = "Cria um workspace com os papéis iniciais Owner e Member")
    public ResponseEntity<AdminWorkspaceResponse> create(
            @AuthenticationPrincipal UUID adminId,
            @Valid @RequestBody CreateWorkspaceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminWorkspaceService.create(adminId, request));
    }

    @GetMapping("/{workspaceId}")
    @Operation(summary = "Detalha um workspace com membros e convites pendentes")
    public AdminWorkspaceDetailResponse get(
            @AuthenticationPrincipal UUID adminId, @PathVariable UUID workspaceId) {
        return adminWorkspaceService.get(adminId, workspaceId);
    }

    @PutMapping("/{workspaceId}")
    @Operation(summary = "Altera o nome e a descrição de um workspace")
    public AdminWorkspaceResponse update(
            @AuthenticationPrincipal UUID adminId,
            @PathVariable UUID workspaceId,
            @Valid @RequestBody UpdateWorkspaceRequest request) {
        return adminWorkspaceService.update(adminId, workspaceId, request);
    }

    @PostMapping("/{workspaceId}/invites/{inviteId}/revoke")
    @Operation(summary = "Revoga um convite pendente do workspace")
    public ResponseEntity<Void> revokeInvite(
            @AuthenticationPrincipal UUID adminId,
            @PathVariable UUID workspaceId,
            @PathVariable UUID inviteId) {
        adminWorkspaceService.revokeInvite(adminId, workspaceId, inviteId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{workspaceId}/invites")
    @Operation(summary = "Convida um e-mail para o workspace como proprietário ou membro",
            description = "Conta já existente e sem workspace entra direto, sem convite por e-mail.")
    public ResponseEntity<AdminInviteResponse> invite(
            @AuthenticationPrincipal UUID adminId,
            @PathVariable UUID workspaceId,
            @Valid @RequestBody AdminInviteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminWorkspaceService.invite(adminId, workspaceId, request));
    }
}
