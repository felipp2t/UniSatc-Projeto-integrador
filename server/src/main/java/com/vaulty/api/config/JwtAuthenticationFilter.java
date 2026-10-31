package com.vaulty.api.config;

import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

// le o cookie accessToken (RNF01) e popula o SecurityContext com o userId
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    @Autowired
    public JwtAuthenticationFilter(JwtService jwtService, WorkspaceMemberRepository workspaceMemberRepository) {
        this.jwtService = jwtService;
        this.workspaceMemberRepository = workspaceMemberRepository;
    }

    // Permite construir o filtro em chamadas legadas; sem repositório, nenhum token autentica.
    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
        this.workspaceMemberRepository = null;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,

            HttpServletResponse response,

            FilterChain filterChain)
            throws ServletException, IOException {
        extractAccessTokenCookie(request)
                .flatMap(jwtService::validateAccessToken)
                .ifPresent(claims -> {
                    if (claims.accountOnly()) {
                        authenticateAccount(claims);
                    } else if (workspaceMemberRepository != null) {
                        workspaceMemberRepository.findByIdAndUserId(claims.membershipId(), claims.userId())
                                .ifPresent(member -> authenticate(claims, member));
                    }
                });

        filterChain.doFilter(request, response);
    }

    private Optional<String> extractAccessTokenCookie(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }

        return List.of(request.getCookies()).stream()
                .filter(cookie -> "accessToken".equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst();
    }

    private void authenticate(JwtService.AccessTokenClaims claims, WorkspaceMember member) {
        List<GrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("WORKSPACE_MEMBER"),
                new SimpleGrantedAuthority(member.getRole().getName()));
        var authentication = new UsernamePasswordAuthenticationToken(claims.userId(), null, authorities);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private void authenticateAccount(JwtService.AccessTokenClaims claims) {
        var authentication = new UsernamePasswordAuthenticationToken(
                claims.userId(), null, List.of(new SimpleGrantedAuthority("ACCOUNT_ONLY")));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
