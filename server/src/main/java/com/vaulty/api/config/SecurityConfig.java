package com.vaulty.api.config;

import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ContentSecurityPolicyHeaderWriter;
import org.springframework.security.web.header.writers.CrossOriginOpenerPolicyHeaderWriter.CrossOriginOpenerPolicy;
import org.springframework.security.web.header.writers.CrossOriginResourcePolicyHeaderWriter.CrossOriginResourcePolicy;
import org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

@Configuration
public class SecurityConfig {

    // A API só devolve JSON e arquivos, então nenhuma resposta precisa carregar recursos.
    static final String API_CONTENT_SECURITY_POLICY =
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

    // O Swagger UI carrega scripts, estilos e imagens da própria origem e usa estilos inline.
    static final String SWAGGER_CONTENT_SECURITY_POLICY =
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
                    + "frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

    static final String PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=()";

    private static final long HSTS_MAX_AGE_SECONDS = 31_536_000L;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,

            RateLimitFilter rateLimitFilter,

            MaintenanceGateFilter maintenanceGateFilter,

            JwtAuthenticationFilter jwtAuthenticationFilter,

            ApiAuthenticationEntryPoint authenticationEntryPoint)
            throws Exception {
        RequestMatcher swaggerUi = new OrRequestMatcher(
                PathPatternRequestMatcher.withDefaults().matcher("/swagger-ui/**"),
                PathPatternRequestMatcher.withDefaults().matcher("/swagger-ui.html"));

        http.csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .headers(headers -> headers
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(new NegatedRequestMatcher(swaggerUi),
                                new ContentSecurityPolicyHeaderWriter(API_CONTENT_SECURITY_POLICY)))
                        .addHeaderWriter(new DelegatingRequestMatcherHeaderWriter(swaggerUi,
                                new ContentSecurityPolicyHeaderWriter(SWAGGER_CONTENT_SECURITY_POLICY)))
                        // Links de convite e de redefinição levam tokens na URL e não podem vazar pelo Referer.
                        .referrerPolicy(referrer -> referrer.policy(ReferrerPolicy.NO_REFERRER))
                        .permissionsPolicyHeader(permissions -> permissions.policy(PERMISSIONS_POLICY))
                        .crossOriginOpenerPolicy(opener -> opener.policy(CrossOriginOpenerPolicy.SAME_ORIGIN))
                        .crossOriginResourcePolicy(resource -> resource.policy(CrossOriginResourcePolicy.SAME_SITE))
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(HSTS_MAX_AGE_SECONDS))
                        .addHeaderWriter((request, response) -> {
                            if ("POST".equals(request.getMethod())
                                    && ("/invites/validate".equals(request.getRequestURI())
                                            || "/invites/decline".equals(request.getRequestURI()))) {
                                response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
                            }
                        }))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(authenticationEntryPoint))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(
                                "/auth/login",
                                "/auth/refresh",
                                "/auth/logout",
                                "/auth/register",
                                "/auth/forgot-password",
                                "/auth/reset-password",
                                "/invites/validate",
                                "/invites/decline",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html")
                        .permitAll()
                        .requestMatchers("/notifications/**", "/me", "/me/**")
                        .authenticated()
                        .anyRequest()
                        .hasAuthority("WORKSPACE_MEMBER"))
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(maintenanceGateFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
