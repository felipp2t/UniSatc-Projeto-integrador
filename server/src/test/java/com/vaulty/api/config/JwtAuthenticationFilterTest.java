package com.vaulty.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.vaulty.api.service.JwtService;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTest {

    private static final String SECRET = "test-secret-with-at-least-thirty-two-bytes";
    private final JwtService jwtService = new JwtService(SECRET, 60_000);
    private final WorkspaceMemberRepository members = mock(WorkspaceMemberRepository.class);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, members);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authenticatesIdentityAndRoleFromTheSameToken() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        stubMembership(membershipId, userId, "Owner");
        Authentication authentication = authenticate(jwtService.generateAccessToken(userId, membershipId, "Owner"));
        assertThat(authentication.getPrincipal()).isEqualTo(userId);
        assertThat(authentication.getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .containsExactly("WORKSPACE_MEMBER", "Owner");
    }

    @Test
    void rejectsLegacyTokensWithoutMembershipClaim() throws Exception {
        UUID userId = UUID.randomUUID();
        assertThat(authenticate(jwtService.generateAccessToken(userId, "Owner"))).isNull();
    }

    @Test
    void usesCurrentDatabaseRoleInsteadOfTheTokenRoleClaim() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        stubMembership(membershipId, userId, "Member");

        Authentication authentication = authenticate(jwtService.generateAccessToken(userId, membershipId, "Owner"));

        assertThat(authentication.getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .containsExactly("WORKSPACE_MEMBER", "Member");
    }

    @Test
    void authenticatesAccountOnlyTokenWithoutWorkspaceAuthorities() throws Exception {
        UUID userId = UUID.randomUUID();

        Authentication authentication = authenticate(jwtService.generateAccountAccessToken(userId));

        assertThat(authentication.getPrincipal()).isEqualTo(userId);
        assertThat(authentication.getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .containsExactly("ACCOUNT_ONLY");
        verifyNoInteractions(members);
    }

    @Test
    void rejectsMembershipMismatchAndMalformedMembershipClaim() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID membershipId = UUID.randomUUID();
        when(members.findByIdAndUserId(membershipId, userId)).thenReturn(Optional.empty());
        assertThat(authenticate(jwtService.generateAccessToken(userId, membershipId, "Owner"))).isNull();
        assertThat(authenticate(signedToken(userId.toString(), "not-a-uuid", "Owner"))).isNull();
    }

    @Test
    void rejectsInvalidExpiredAndWronglySignedTokens() throws Exception {
        assertThat(authenticate("invalid")).isNull();
        assertThat(authenticate(new JwtService(SECRET, -1000)
                .generateAccessToken(UUID.randomUUID(), UUID.randomUUID(), "Owner"))).isNull();
        assertThat(authenticate(new JwtService("another-secret-with-at-least-thirty-two-bytes", 60_000)
                .generateAccessToken(UUID.randomUUID(), UUID.randomUUID(), "Owner"))).isNull();
    }

    @Test
    void rejectsMissingOrMalformedSubjectsAndInvalidRoles() throws Exception {
        assertThat(authenticate(signedToken(null, UUID.randomUUID().toString(), "Owner"))).isNull();
        assertThat(authenticate(signedToken("not-a-uuid", UUID.randomUUID().toString(), "Owner"))).isNull();
        assertThat(authenticate(signedToken(UUID.randomUUID().toString(), UUID.randomUUID().toString(), " "))).isNull();
        assertThat(authenticate(signedToken(UUID.randomUUID().toString(), UUID.randomUUID().toString(), 42))).isNull();
    }

    private String signedToken(String subject, Object membershipId, Object role) {
        return Jwts.builder()
                .subject(subject)
                .claim("membershipId", membershipId)
                .claim("role", role)
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    private void stubMembership(UUID membershipId, UUID userId, String currentRole) {
        WorkspaceRole role = new WorkspaceRole();
        role.setName(currentRole);
        WorkspaceMember member = new WorkspaceMember();
        member.setRole(role);
        when(members.findByIdAndUserId(membershipId, userId)).thenReturn(Optional.of(member));
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
