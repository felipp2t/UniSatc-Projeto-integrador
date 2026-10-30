package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.workspace.ChangeMemberRoleRequest;
import com.vaulty.api.dto.workspace.WorkspaceMemberResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;

@Tag(name = "Membros")
public interface WorkspaceMemberControllerDocs {

    @Operation(summary = "Lista os membros de um workspace")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "404")})
    List<WorkspaceMemberResponse> list(@Parameter(hidden = true) UUID userId, UUID workspaceId);

    @Operation(summary = "Atribui um papel a um membro, preservando ao menos um dono")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400"),
            @ApiResponse(responseCode = "401"), @ApiResponse(responseCode = "403"),
            @ApiResponse(responseCode = "404"), @ApiResponse(responseCode = "409")})
    WorkspaceMemberResponse changeRole(@Parameter(hidden = true) UUID userId, UUID workspaceId, UUID memberId,
                                       ChangeMemberRoleRequest request);
}
