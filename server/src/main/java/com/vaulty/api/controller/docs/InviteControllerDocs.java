package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.invite.InviteUserRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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
}
