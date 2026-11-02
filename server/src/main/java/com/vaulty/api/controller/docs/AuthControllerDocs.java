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

    @Operation(
            summary = "Solicita redefinição de senha",
            description = "RF49-CA01: retorna a mesma resposta sem revelar se o e-mail possui conta. "
                    + "RF49-CA02: o link vale por uma hora. RF49-CA04: quando há conta, invalida links "
                    + "anteriores e envia um link novo.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Solicitação aceita; corpo vazio."),
        @ApiResponse(responseCode = "429", description = "Limite de solicitações excedido.")
    })
    ResponseEntity<Void> forgotPassword(ForgotPasswordRequest request);

    @Operation(
            summary = "Redefine a senha com token",
            description = "RF49-CA02: o token é válido por uma hora. RF49-CA03: o token é de uso único. "
                    + "RF49-CA05: a redefinição invalida links de recuperação pendentes e refresh tokens. "
                    + "RF49-CA06: não inicia sessão nem emite cookies. RF49-CA07: token indisponível "
                    + "não altera a senha e permite nova solicitação.")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Senha redefinida; corpo vazio."),
        @ApiResponse(responseCode = "400", description = "Corpo inválido ou senhas não coincidem."),
        @ApiResponse(responseCode = "401", description = "Token inexistente, expirado ou já utilizado."),
        @ApiResponse(responseCode = "429", description = "Limite de tentativas excedido.")
    })
    ResponseEntity<Void> resetPassword(ResetPasswordRequest request);
}
