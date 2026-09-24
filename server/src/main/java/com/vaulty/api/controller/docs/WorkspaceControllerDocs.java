package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.workspace.CreateWorkspaceRequest;
import com.vaulty.api.dto.workspace.UpdateWorkspaceRequest;
import com.vaulty.api.dto.workspace.WorkspaceResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;

@Tag(name = "Workspaces")
public interface WorkspaceControllerDocs {

    @Operation(summary = "Cria um workspace")
    @ApiResponses({@ApiResponse(responseCode = "201"), @ApiResponse(responseCode = "400")})
    WorkspaceResponse create(@Parameter(hidden = true) UUID userId, CreateWorkspaceRequest request);

    @Operation(summary = "Lista os workspaces do usuário")
    @ApiResponse(responseCode = "200")
    List<WorkspaceResponse> list(@Parameter(hidden = true) UUID userId);

    @Operation(summary = "Consulta um workspace")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "404")})
    WorkspaceResponse get(@Parameter(hidden = true) UUID userId, UUID workspaceId);

    @Operation(summary = "Substitui os dados de um workspace")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400"), @ApiResponse(responseCode = "404")})
    WorkspaceResponse update(
            @Parameter(hidden = true) UUID userId, UUID workspaceId, UpdateWorkspaceRequest request);
}
