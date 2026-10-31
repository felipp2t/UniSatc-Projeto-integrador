package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.role.RoleRequest;
import com.vaulty.api.dto.role.RoleResponse;
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

    @Operation(summary = "Lista os papéis do workspace com a quantidade de membros de cada um")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404")})
    ResponseEntity<List<RoleResponse>> list(@Parameter(hidden = true) UUID userId,
                                            @PathVariable UUID workspaceId);

    @Operation(summary = "Cria um papel personalizado sem permissões")
    @ApiResponses({@ApiResponse(responseCode = "201"), @ApiResponse(responseCode = "400"),
            @ApiResponse(responseCode = "401"), @ApiResponse(responseCode = "403"),
            @ApiResponse(responseCode = "404"), @ApiResponse(responseCode = "409")})
    ResponseEntity<RoleResponse> create(@Parameter(hidden = true) UUID userId,
                                        @PathVariable UUID workspaceId,
                                        @Valid @RequestBody RoleRequest request);

    @Operation(summary = "Consulta as permissões de um papel")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404")})
    ResponseEntity<List<WorkspacePermission>> permissions(@Parameter(hidden = true) UUID userId,
                                                          @PathVariable UUID workspaceId,
                                                          @PathVariable UUID roleId);

    @Operation(summary = "Exclui um papel personalizado sem membros vinculados")
    @ApiResponses({@ApiResponse(responseCode = "204"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404"),
            @ApiResponse(responseCode = "409")})
    ResponseEntity<Void> delete(@Parameter(hidden = true) UUID userId, @PathVariable UUID workspaceId,
                                @PathVariable UUID roleId);

    @Operation(summary = "Lista o catálogo de permissões disponíveis")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "403"),
            @ApiResponse(responseCode = "404")})
    ResponseEntity<List<WorkspacePermission>> catalog(@Parameter(hidden = true) UUID userId,
                                                       @PathVariable UUID workspaceId);

    @Operation(summary = "Substitui as permissões de um papel")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404")})
    ResponseEntity<RolePermissionsResponse> replacePermissions(
            @Parameter(hidden = true) UUID userId, @PathVariable UUID workspaceId, @PathVariable UUID roleId,
            @Valid @RequestBody RolePermissionsRequest request);
}
