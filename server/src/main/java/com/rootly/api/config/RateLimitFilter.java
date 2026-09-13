package com.rootly.api.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rootly.api.exception.ApiErrorBody;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

// limita brute-force/spam em login, cadastro e recuperacao de senha, igual ao authRateLimit do rootly original (5 req/min)
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final List<String> LIMITED_PATHS =
            List.of("/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password");

    private final ObjectMapper objectMapper;
    private final RateLimitRegistry registry;

    public RateLimitFilter(ObjectMapper objectMapper, RateLimitRegistry registry) {
        this.objectMapper = objectMapper;
        this.registry = registry;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,

            HttpServletResponse response,

            FilterChain filterChain)
            throws ServletException, IOException {
        if (!isRateLimited(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = request.getRemoteAddr() + ":" + request.getRequestURI();
        if (registry.tryConsume(key)) {
            filterChain.doFilter(request, response);
            return;
        }

        writeTooManyRequests(request, response);
    }

    private boolean isRateLimited(HttpServletRequest request) {
        return "POST".equals(request.getMethod()) && LIMITED_PATHS.contains(request.getRequestURI());
    }

    private void writeTooManyRequests(HttpServletRequest request, HttpServletResponse response) throws IOException {
        ApiErrorBody body = ApiErrorBody.of(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase(),
                "Muitas requisições, tente novamente mais tarde",
                request.getRequestURI());

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
