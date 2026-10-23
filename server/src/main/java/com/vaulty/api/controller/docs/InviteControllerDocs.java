package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.invite.InviteUserRequest;
import com.vaulty.api.dto.invite.InviteValidationRequest;
import com.vaulty.api.dto.invite.InviteValidationResponse;
import com.vaulty.api.exception.ApiErrorBody;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

@Tag(name = "Convites")
public interface InviteControllerDocs {

    @Operation(summary = "Envia convite para um novo usuário")
    @ApiResponses({@ApiResponse(responseCode = "201"), @ApiResponse(responseCode = "409")})
    ResponseEntity<Void> invite(@Parameter(hidden = true) UUID inviterId, InviteUserRequest request);

    @Operation(summary = "Valida convite para cadastro")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Convite válido"),
        @ApiResponse(
                responseCode = "400",
                description = "E-mail ou token em formato inválido",
                content = @Content(schema = @Schema(implementation = ApiErrorBody.class))),
        @ApiResponse(
                responseCode = "404",
                description = "Convite indisponível",
                content = @Content(schema = @Schema(implementation = ApiErrorBody.class))),
        @ApiResponse(
                responseCode = "429",
                description = "Limite de tentativas excedido",
                content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
    })
    ResponseEntity<InviteValidationResponse> validate(InviteValidationRequest request);

    @Operation(summary = "Recusa convite recebido")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Convite recusado"),
        @ApiResponse(
                responseCode = "400",
                description = "E-mail ou token em formato inválido",
                content = @Content(schema = @Schema(implementation = ApiErrorBody.class))),
        @ApiResponse(
                responseCode = "404",
                description = "Convite indisponível",
                content = @Content(schema = @Schema(implementation = ApiErrorBody.class))),
        @ApiResponse(
                responseCode = "429",
                description = "Limite de tentativas excedido",
                content = @Content(schema = @Schema(implementation = ApiErrorBody.class)))
    })
    ResponseEntity<Void> decline(InviteValidationRequest request);
}
