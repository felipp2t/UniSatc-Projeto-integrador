package com.vaulty.api.config;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.service.JwtService;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
@TestPropertySource(properties = "jwt.access-token-expiration-ms=-1000")
class SecurityIntegrationTest extends PostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtService jwtService;

    @Test
    void returnsDocumentedJsonForMissingToken() throws Exception {
        assertUnauthorized(mockMvc.perform(get("/me")));
    }

    @Test
    void requiresAuthenticationToChangePassword() throws Exception {
        mockMvc.perform(patch("/me/password")
                        .contentType("application/json")
                        .content("""
                                {"currentPassword":"old-password","newPassword":"new-password","confirmPassword":"new-password"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.path").value("/me/password"));
    }

    @Test
    void returnsDocumentedJsonForInvalidToken() throws Exception {
        assertUnauthorized(mockMvc.perform(get("/me").cookie(new Cookie("accessToken", "invalid"))));
    }

    @Test
    void returnsDocumentedJsonForExpiredToken() throws Exception {
        String expiredToken = jwtService.generateAccessToken(UUID.randomUUID(), UUID.randomUUID(), null);
        assertUnauthorized(mockMvc.perform(get("/me").cookie(new Cookie("accessToken", expiredToken))));
    }

    @Test
    void exposesOpenApiDocumentationWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.paths['/workspaces'].get.summary").value("Lista os workspaces do usuário"))
                .andExpect(jsonPath("$.paths['/workspaces/{workspaceId}/me/permissions'].get.summary")
                        .value("Consulta as permissões do usuário no workspace"))
                .andExpect(jsonPath("$.paths['/workspaces/{workspaceId}/members'].get.summary")
                        .value("Lista os membros de um workspace"));
    }

    @Test
    void allowsConfiguredFrontendOriginWithCredentials() throws Exception {
        mockMvc.perform(options("/me")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void apiResponsesCarrySecurityHeadersEvenWhenUnauthorized() throws Exception {
        mockMvc.perform(get("/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Content-Security-Policy", SecurityConfig.API_CONTENT_SECURITY_POLICY))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Permissions-Policy", SecurityConfig.PERMISSIONS_POLICY))
                .andExpect(header().string("Cross-Origin-Opener-Policy", "same-origin"))
                .andExpect(header().string("Cross-Origin-Resource-Policy", "same-site"))
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(header().doesNotExist("Strict-Transport-Security"));
    }

    @Test
    void sendsHstsOnlyOverHttps() throws Exception {
        mockMvc.perform(get("/me").secure(true))
                .andExpect(header().string("Strict-Transport-Security",
                        allOf(containsString("max-age=31536000"), containsString("includeSubDomains"))));
    }

    @Test
    void swaggerUiReceivesItsOwnContentSecurityPolicy() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Security-Policy",
                        SecurityConfig.SWAGGER_CONTENT_SECURITY_POLICY));
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(header().string("Content-Security-Policy", SecurityConfig.API_CONTENT_SECURITY_POLICY));
    }

    @Test
    void rejectsPreflightFromUnknownOrigin() throws Exception {
        mockMvc.perform(options("/me")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void rejectsPreflightWithHeaderOrMethodOutsideThePolicy() throws Exception {
        mockMvc.perform(options("/me")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "X-Custom-Header"))
                .andExpect(status().isForbidden());
        mockMvc.perform(options("/me")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "TRACE"))
                .andExpect(status().isForbidden());
    }

    @Test
    void exposesAttachmentFileNameHeaderToTheFrontend() throws Exception {
        mockMvc.perform(get("/me").header("Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Expose-Headers", "Content-Disposition"));
    }

    private void assertUnauthorized(org.springframework.test.web.servlet.ResultActions result) throws Exception {
        result.andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.path").value("/me"));
    }
}
