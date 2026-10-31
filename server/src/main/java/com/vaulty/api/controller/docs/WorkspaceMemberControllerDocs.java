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
import org.springframework.http.ResponseEntity;

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

    @Operation(summary = "Remove um membro do workspace",
            description = "Somente membro ativo com papel Owner pode remover. confirmMemberId deve repetir o ID do vínculo para confirmar explicitamente.")
    @ApiResponses({@ApiResponse(responseCode = "204", description = "Membro removido"),
        @ApiResponse(responseCode = "400", description = "Confirmação ausente ou divergente"),
        @ApiResponse(responseCode = "403", description = "Somente o dono pode remover membros"),
        @ApiResponse(responseCode = "404", description = "Workspace ou membro não encontrado"),
        @ApiResponse(responseCode = "409", description = "O último dono não pode ser removido")})
    ResponseEntity<Void> remove(@Parameter(hidden = true) UUID userId, UUID workspaceId, UUID membershipId,
                                @Parameter(description = "ID do vínculo confirmado", required = true) UUID confirmMemberId);
}
