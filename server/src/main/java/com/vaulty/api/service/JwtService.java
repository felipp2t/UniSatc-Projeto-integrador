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

    public String generateAccessToken(UUID userId, UUID membershipId, String role) {
        Instant now = Instant.now();

        var builder = Jwts.builder()
                .subject(userId.toString())
                .claim("membershipId", membershipId.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(accessTokenExpirationMs)));

        if (role != null) {
            builder.claim("role", role);
        }

        return builder.signWith(key).compact();
    }

    // Mantido para compatibilidade com chamadas legadas; tokens sem vínculo não autenticam.
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

    public record AccessTokenClaims(UUID userId, UUID membershipId, String role) {}

    // Tokens antigos sem role continuam autenticados, mas não recebem authorities.
    public Optional<AccessTokenClaims> validateAccessToken(String token) {
        try {
            var claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String subject = claims.getSubject();
            String membershipId = claims.get("membershipId", String.class);
            String role = claims.get("role", String.class);
            if (subject == null || membershipId == null || membershipId.isBlank()
                    || (role != null && role.isBlank())) {
                return Optional.empty();
            }
            return Optional.of(new AccessTokenClaims(
                    UUID.fromString(subject), UUID.fromString(membershipId), role));
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
