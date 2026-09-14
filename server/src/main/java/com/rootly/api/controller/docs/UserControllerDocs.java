package com.rootly.api.controller.docs;

import com.rootly.api.dto.user.ChangePasswordRequest;
import com.rootly.api.dto.user.UpdateProfileRequest;
import com.rootly.api.dto.user.UserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

@Tag(name = "Usuário")
public interface UserControllerDocs {

    @Operation(summary = "Consulta o perfil autenticado")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "401")})
    UserResponse getMe(@Parameter(hidden = true) UUID userId);

    @Operation(summary = "Atualiza o perfil autenticado")
    @ApiResponses({@ApiResponse(responseCode = "204"), @ApiResponse(responseCode = "400")})
    ResponseEntity<Void> updateProfile(@Parameter(hidden = true) UUID userId, UpdateProfileRequest request);

    @Operation(summary = "Altera a senha do usuário autenticado")
    @ApiResponses({@ApiResponse(responseCode = "204"), @ApiResponse(responseCode = "400"), @ApiResponse(responseCode = "401")})
    ResponseEntity<Void> changePassword(@Parameter(hidden = true) UUID userId, ChangePasswordRequest request);
}
