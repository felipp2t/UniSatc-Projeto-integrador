package com.rootly.api.controller;

import com.rootly.api.dto.auth.ForgotPasswordRequest;
import com.rootly.api.dto.auth.LoginRequest;
import com.rootly.api.dto.auth.RegisterRequest;
import com.rootly.api.dto.auth.ResetPasswordRequest;
import com.rootly.api.dto.auth.TokenPair;
import com.rootly.api.exception.InvalidCredentialsException;
import com.rootly.api.service.AuthService;
import com.rootly.api.service.JwtService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final AuthService authService;

    private final JwtService jwtService;

    public AuthController(
            AuthService authService,

            JwtService jwtService) {
        this.authService = authService;
        this.jwtService = jwtService;
    }

    @PostMapping("/auth/login")
    public ResponseEntity<Void> login(@Valid @RequestBody LoginRequest request) {
        TokenPair tokens = authService.login(request);

        return withAuthCookies(tokens).build();
    }

    @PostMapping("/auth/refresh")
    public ResponseEntity<Void> refresh(HttpServletRequest request) {
        String refreshToken = readCookie(request, "refreshToken")
                .orElseThrow(() -> new InvalidCredentialsException("Token de atualização inválido"));

        TokenPair tokens = authService.refreshToken(refreshToken);

        return withAuthCookies(tokens).build();
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        String refreshToken = readCookie(request, "refreshToken")
                .orElseThrow(() -> new InvalidCredentialsException("Token de atualização inválido"));

        authService.logout(refreshToken);

        return ResponseEntity.status(HttpStatus.NO_CONTENT)
                .header(HttpHeaders.SET_COOKIE, clearCookie("accessToken").toString())
                .header(HttpHeaders.SET_COOKIE, clearCookie("refreshToken").toString())
                .build();
    }

    @PostMapping("/auth/register")
    public ResponseEntity<Void> register(@Valid @RequestBody RegisterRequest request) {
        TokenPair tokens = authService.register(request);

        return withAuthCookies(tokens).build();
    }

    @PostMapping("/auth/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @PostMapping("/auth/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    private ResponseEntity.BodyBuilder withAuthCookies(TokenPair tokens) {
        ResponseCookie accessTokenCookie = ResponseCookie.from("accessToken", tokens.accessToken())
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .maxAge(jwtService.getAccessTokenExpirationSeconds())
                .build();

        ResponseCookie refreshTokenCookie = ResponseCookie.from("refreshToken", tokens.refreshToken())
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/")
                .build();

        return ResponseEntity.status(HttpStatus.OK)
                .header(HttpHeaders.SET_COOKIE, accessTokenCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString());
    }

    private ResponseCookie clearCookie(String name) {
        return ResponseCookie.from(name, "").httpOnly(true).secure(true).sameSite("Strict").path("/").maxAge(0).build();
    }

    private Optional<String> readCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }

        return List.of(request.getCookies()).stream()
                .filter(cookie -> name.equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst();
    }
}
