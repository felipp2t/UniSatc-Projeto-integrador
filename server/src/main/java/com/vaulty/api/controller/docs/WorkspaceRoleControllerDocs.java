package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.role.RoleRequest;
import com.vaulty.api.dto.role.RoleResponse;
import com.vaulty.api.dto.role.WorkspaceRoleDefinitionResponse;
import com.vaulty.api.dto.workspace.RolePermissionsRequest;
import com.vaulty.api.dto.workspace.RolePermissionsResponse;
import com.vaulty.api.dto.workspace.WorkspacePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;

@Tag(name = "Papéis")
public interface WorkspaceRoleControllerDocs {

    @Operation(summary = "Lista os cinco papéis fixos do workspace")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404")})
    ResponseEntity<List<WorkspaceRoleDefinitionResponse>> list(@Parameter(hidden = true) UUID userId,
                                                               @PathVariable UUID workspaceId);

    @Operation(summary = "Criação de papéis customizados desativada")
    @ApiResponses({@ApiResponse(responseCode = "400"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404"),
            @ApiResponse(responseCode = "409", description = "Papéis customizados estão desativados")})
    ResponseEntity<RoleResponse> create(@Parameter(hidden = true) UUID userId,
                                        @PathVariable UUID workspaceId,
                                        @Valid @RequestBody RoleRequest request);

    @Operation(summary = "Renomeação de papéis desativada")
    @ApiResponses({@ApiResponse(responseCode = "400"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404"),
            @ApiResponse(responseCode = "409", description = "Papéis customizados estão desativados")})
    ResponseEntity<RoleResponse> rename(@Parameter(hidden = true) UUID userId,
                                        @PathVariable UUID workspaceId, @PathVariable UUID roleId,
                                        @Valid @RequestBody RoleRequest request);

    @Operation(summary = "Consulta por ID legado desativada; use a definição retornada pela lista")
    @ApiResponses({@ApiResponse(responseCode = "401"), @ApiResponse(responseCode = "403"),
            @ApiResponse(responseCode = "404"),
            @ApiResponse(responseCode = "409", description = "Consulta por papel legado está desativada")})
    ResponseEntity<List<WorkspacePermission>> permissions(@Parameter(hidden = true) UUID userId,
                                                          @PathVariable UUID workspaceId,
                                                          @PathVariable UUID roleId);

    @Operation(summary = "Exclusão de papéis desativada")
    @ApiResponses({@ApiResponse(responseCode = "401"), @ApiResponse(responseCode = "403"),
            @ApiResponse(responseCode = "404"),
            @ApiResponse(responseCode = "409", description = "Exclusão de papéis está desativada")})
    ResponseEntity<Void> delete(@Parameter(hidden = true) UUID userId, @PathVariable UUID workspaceId,
                                @PathVariable UUID roleId);

    @Operation(summary = "Catálogo de permissões customizadas desativado")
    @ApiResponses({@ApiResponse(responseCode = "401"), @ApiResponse(responseCode = "403"),
            @ApiResponse(responseCode = "404"),
            @ApiResponse(responseCode = "409", description = "Catálogo customizado está desativado")})
    ResponseEntity<List<WorkspacePermission>> catalog(@Parameter(hidden = true) UUID userId,
                                                       @PathVariable UUID workspaceId);

    @Operation(summary = "Alteração das permissões dos papéis desativada")
    @ApiResponses({@ApiResponse(responseCode = "400"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404"),
            @ApiResponse(responseCode = "409", description = "Alteração de permissões está desativada")})
    ResponseEntity<RolePermissionsResponse> replacePermissions(
            @Parameter(hidden = true) UUID userId, @PathVariable UUID workspaceId, @PathVariable UUID roleId,
            @Valid @RequestBody RolePermissionsRequest request);
}
