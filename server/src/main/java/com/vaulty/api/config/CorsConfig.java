package com.vaulty.api.config;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.frontend-url}") String frontendUrl) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigin(frontendUrl)));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Accept", "Content-Type"));
        // O nome do anexo baixado vem neste header, que o navegador esconde de outra origem por padrão.
        configuration.setExposedHeaders(List.of(HttpHeaders.CONTENT_DISPOSITION));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    // Uma origem coringa com cookies liberaria a API para qualquer site; a aplicação não sobe assim.
    static String allowedOrigin(String frontendUrl) {
        URI uri;
        try {
            uri = URI.create(frontendUrl == null ? "" : frontendUrl.trim());
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("app.frontend-url deve ser uma URL http(s) válida", exception);
        }
        String scheme = uri.getScheme();
        if (uri.getHost() == null || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                || uri.getPort() > 65535) {
            throw new IllegalStateException("app.frontend-url deve ser uma URL http(s) válida");
        }
        int portNumber = uri.getPort();
        if (("http".equalsIgnoreCase(scheme) && portNumber == 80)
                || ("https".equalsIgnoreCase(scheme) && portNumber == 443)) {
            portNumber = -1;
        }
        String port = portNumber == -1 ? "" : ":" + portNumber;
        return scheme.toLowerCase(Locale.ROOT) + "://" + uri.getHost().toLowerCase(Locale.ROOT) + port;
    }
}
