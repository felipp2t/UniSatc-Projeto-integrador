package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.accessgroup.AccessGroupMemberResponse;
import com.vaulty.api.dto.accessgroup.AccessGroupRequest;
import com.vaulty.api.dto.accessgroup.AccessGroupResponse;
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

@Tag(name = "Grupos de acesso")
public interface AccessGroupControllerDocs {

    @Operation(summary = "Lista os grupos de acesso do workspace")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403")})
    ResponseEntity<List<AccessGroupResponse>> list(@Parameter(hidden = true) UUID userId,
                                                   @PathVariable UUID workspaceId);

    @Operation(summary = "Cria um grupo de acesso")
    @ApiResponses({@ApiResponse(responseCode = "201"), @ApiResponse(responseCode = "400"),
            @ApiResponse(responseCode = "401"), @ApiResponse(responseCode = "403"),
            @ApiResponse(responseCode = "409")})
    ResponseEntity<AccessGroupResponse> create(@Parameter(hidden = true) UUID userId,
                                               @PathVariable UUID workspaceId,
                                               @Valid @RequestBody AccessGroupRequest request);

    @Operation(summary = "Renomeia um grupo de acesso")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400"),
            @ApiResponse(responseCode = "401"), @ApiResponse(responseCode = "403"),
            @ApiResponse(responseCode = "404"), @ApiResponse(responseCode = "409")})
    ResponseEntity<AccessGroupResponse> rename(@Parameter(hidden = true) UUID userId,
                                               @PathVariable UUID workspaceId,
                                               @PathVariable UUID groupId,
                                               @Valid @RequestBody AccessGroupRequest request);

    @Operation(summary = "Exclui um grupo vazio")
    @ApiResponses({@ApiResponse(responseCode = "204"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404"),
            @ApiResponse(responseCode = "409")})
    ResponseEntity<Void> delete(@Parameter(hidden = true) UUID userId, @PathVariable UUID workspaceId,
                                @PathVariable UUID groupId);

    @Operation(summary = "Lista os integrantes atuais de um grupo")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404")})
    ResponseEntity<List<AccessGroupMemberResponse>> listMembers(@Parameter(hidden = true) UUID userId,
                                                                @PathVariable UUID workspaceId,
                                                                @PathVariable UUID groupId);

    @Operation(summary = "Adiciona um integrante atual ao grupo")
    @ApiResponses({@ApiResponse(responseCode = "204"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404")})
    ResponseEntity<Void> addMember(@Parameter(hidden = true) UUID userId, @PathVariable UUID workspaceId,
                                   @PathVariable UUID groupId, @PathVariable UUID workspaceMemberId);

    @Operation(summary = "Remove um integrante do grupo")
    @ApiResponses({@ApiResponse(responseCode = "204"), @ApiResponse(responseCode = "401"),
            @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404")})
    ResponseEntity<Void> removeMember(@Parameter(hidden = true) UUID userId, @PathVariable UUID workspaceId,
                                      @PathVariable UUID groupId, @PathVariable UUID workspaceMemberId);
}
