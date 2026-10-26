package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.auth.ForgotPasswordRequest;
import com.vaulty.api.dto.auth.LoginRequest;
import com.vaulty.api.dto.auth.RegisterRequest;
import com.vaulty.api.dto.auth.ResetPasswordRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;

@Tag(name = "Autenticação")
public interface AuthControllerDocs {

    @Operation(summary = "Autentica um usuário")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "401")})
    ResponseEntity<Void> login(LoginRequest request);

    @Operation(summary = "Renova os tokens de autenticação")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "401")})
    ResponseEntity<Void> refresh(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(summary = "Encerra a sessão atual")
    @ApiResponses({@ApiResponse(responseCode = "204"), @ApiResponse(responseCode = "401")})
    ResponseEntity<Void> logout(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(summary = "Conclui o cadastro por convite")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400")})
    ResponseEntity<Void> register(RegisterRequest request);

    @Operation(summary = "Solicita redefinição de senha")
    @ApiResponse(responseCode = "204")
    ResponseEntity<Void> forgotPassword(ForgotPasswordRequest request);

    @Operation(summary = "Redefine a senha com token")
    @ApiResponses({@ApiResponse(responseCode = "204"), @ApiResponse(responseCode = "400"), @ApiResponse(responseCode = "401")})
    ResponseEntity<Void> resetPassword(ResetPasswordRequest request);
}
