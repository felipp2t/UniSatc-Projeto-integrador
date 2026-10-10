package com.rootly.api.service;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final SecretKey key;

    private final long accessTokenExpirationMs;

    public JwtService(
            @Value("${jwt.secret}")
            String secret,

            @Value("${jwt.access-token-expiration-ms}")
            long accessTokenExpirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpirationMs = accessTokenExpirationMs;
    }

    public String generateAccessToken(UUID userId) {
        return generateAccessToken(userId, null);
    }

    // role fica nula pra quem ainda nao tem papel no workspace (nao deveria acontecer em uso normal)
    public String generateAccessToken(UUID userId, String role) {
        Instant now = Instant.now();

        var builder = Jwts.builder()
                .subject(userId.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(accessTokenExpirationMs)));

        if (role != null) {
            builder.claim("role", role);
        }

        return builder.signWith(key).compact();
    }

    public int getAccessTokenExpirationSeconds() {
        return (int) (accessTokenExpirationMs / 1000);
    }

    // vazio se o token for invalido, malformado ou expirado
    public Optional<UUID> validateAndGetUserId(String token) {
        try {
            String subject = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload()
                    .getSubject();

            return Optional.of(UUID.fromString(subject));
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    // vazio se o token for invalido ou nao tiver a claim role
    public Optional<String> extractRole(String token) {
        try {
            String role = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload()
                    .get("role", String.class);

            return Optional.ofNullable(role);
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
