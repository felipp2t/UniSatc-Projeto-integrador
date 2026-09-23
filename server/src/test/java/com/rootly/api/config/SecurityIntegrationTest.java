package com.rootly.api.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rootly.api.PostgresIntegrationTest;
import com.rootly.api.service.JwtService;
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
    void returnsDocumentedJsonForInvalidToken() throws Exception {
        assertUnauthorized(mockMvc.perform(get("/me").cookie(new Cookie("accessToken", "invalid"))));
    }

    @Test
    void returnsDocumentedJsonForExpiredToken() throws Exception {
        String expiredToken = jwtService.generateAccessToken(UUID.randomUUID());
        assertUnauthorized(mockMvc.perform(get("/me").cookie(new Cookie("accessToken", expiredToken))));
    }

    @Test
    void exposesOpenApiDocumentationWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.paths['/workspaces'].post.summary").value("Cria um workspace"))
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

    private void assertUnauthorized(org.springframework.test.web.servlet.ResultActions result) throws Exception {
        result.andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.path").value("/me"));
    }
}
