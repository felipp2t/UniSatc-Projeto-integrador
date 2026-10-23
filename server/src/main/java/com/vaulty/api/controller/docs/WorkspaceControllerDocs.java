package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.activity.ActivityPageResponse;
import com.vaulty.api.dto.workspace.UpdateWorkspaceRequest;
import com.vaulty.api.dto.workspace.WorkspaceResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Tag(name = "Workspaces")
public interface WorkspaceControllerDocs {

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

    @Operation(summary = "Consulta o histórico de atividades do workspace")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "403"),
            @ApiResponse(responseCode = "404")})
    ActivityPageResponse activity(
            @Parameter(hidden = true) UUID userId,
            UUID workspaceId,
            int page,
            int size,
            OffsetDateTime from,
            OffsetDateTime to,
            UUID actorId,
            String action,
            String resourceType);
}
