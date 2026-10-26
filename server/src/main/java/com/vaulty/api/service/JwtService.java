package com.vaulty.api.service;

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

    // Usuários anteriores ao vínculo obrigatório podem não ter papel no workspace.
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

    public record AccessTokenClaims(UUID userId, String role) {}

    // Tokens antigos sem role continuam autenticados, mas não recebem authorities.
    public Optional<AccessTokenClaims> validateAccessToken(String token) {
        try {
            var claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String subject = claims.getSubject();
            String role = claims.get("role", String.class);
            if (subject == null || (role != null && role.isBlank())) {
                return Optional.empty();
            }
            return Optional.of(new AccessTokenClaims(UUID.fromString(subject), role));
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
