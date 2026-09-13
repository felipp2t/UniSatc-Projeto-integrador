package com.rootly.api.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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

    private void assertUnauthorized(org.springframework.test.web.servlet.ResultActions result) throws Exception {
        result.andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.path").value("/me"));
    }
}
