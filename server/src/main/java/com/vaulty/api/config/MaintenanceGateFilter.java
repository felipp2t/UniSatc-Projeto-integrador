package com.vaulty.api.config;

import com.vaulty.api.service.MaintenanceGate;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class MaintenanceGateFilter extends OncePerRequestFilter {
    private final MaintenanceGate gate;

    public MaintenanceGateFilter(MaintenanceGate gate) {
        this.gate = gate;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String method = request.getMethod();
        boolean mutation = !HttpMethod.GET.matches(method) && !HttpMethod.HEAD.matches(method)
                && !HttpMethod.OPTIONS.matches(method);
        if (!mutation || (HttpMethod.POST.matches(method) && "/workspaces/backup".equals(request.getServletPath()))) {
            chain.doFilter(request, response);
            return;
        }
        MaintenanceGate.Lease lease;
        try {
            lease = gate.enterWriter();
        } catch (com.vaulty.api.exception.ConflictException exception) {
            response.setStatus(HttpServletResponse.SC_CONFLICT);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"message\":\"" + exception.getMessage() + "\"}");
            return;
        }
        try (lease) {
            chain.doFilter(request, response);
        }
    }
}
