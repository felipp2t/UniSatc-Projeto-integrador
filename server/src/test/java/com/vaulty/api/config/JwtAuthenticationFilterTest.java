package com.vaulty.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.vaulty.api.service.JwtService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class JwtAuthenticationFilterTest {

    private static final String SECRET = "test-secret-with-at-least-thirty-two-bytes";
    private final JwtService jwtService = new JwtService(SECRET, 60_000);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatesIdentityAndRoleFromTheSameToken() throws Exception {
        UUID userId = UUID.randomUUID();
        for (String role : new String[] {"Owner", "Member"}) {
            Authentication authentication = authenticate(jwtService.generateAccessToken(userId, role));
            assertThat(authentication.getPrincipal()).isEqualTo(userId);
            assertThat(authentication.getAuthorities()).extracting(GrantedAuthority::getAuthority).containsExactly(role);
        }
    }

    @Test
    void acceptsLegacyTokensWithoutGrantingAuthorities() throws Exception {
        UUID userId = UUID.randomUUID();
        Authentication authentication = authenticate(jwtService.generateAccessToken(userId, null));
        assertThat(authentication.getPrincipal()).isEqualTo(userId);
        assertThat(authentication.getAuthorities()).isEmpty();
    }

    @Test
    void rejectsInvalidExpiredAndWronglySignedTokens() throws Exception {
        assertThat(authenticate("invalid")).isNull();
        assertThat(authenticate(new JwtService(SECRET, -1000)
                .generateAccessToken(UUID.randomUUID(), "Owner"))).isNull();
        assertThat(authenticate(new JwtService("another-secret-with-at-least-thirty-two-bytes", 60_000)
                .generateAccessToken(UUID.randomUUID(), "Owner"))).isNull();
    }

    @Test
    void rejectsMissingOrMalformedSubjectsAndInvalidRoles() throws Exception {
        assertThat(authenticate(signedToken(null, "Owner"))).isNull();
        assertThat(authenticate(signedToken("not-a-uuid", "Owner"))).isNull();
        assertThat(authenticate(signedToken(UUID.randomUUID().toString(), " "))).isNull();
        assertThat(authenticate(signedToken(UUID.randomUUID().toString(), 42))).isNull();
    }

    private String signedToken(String subject, Object role) {
        return Jwts.builder()
                .subject(subject)
                .claim("role", role)
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    private Authentication authenticate(String token) throws ServletException, IOException {
        SecurityContextHolder.clearContext();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("accessToken", token));
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, new MockHttpServletResponse(), chain);
        assertThat(chain.getRequest()).isSameAs(request);
        return SecurityContextHolder.getContext().getAuthentication();
    }
}
