package com.vaulty.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.entity.User;
import com.vaulty.api.repository.RefreshTokenRepository;
import com.vaulty.api.repository.UserRepository;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@AutoConfigureMockMvc
class AuthLoginIntegrationTest extends PostgresIntegrationTest {

    private static final String INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha inválidos";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    @Test
    void unknownEmailAndWrongPasswordReturnTheSameUnauthorizedResponseWithoutSessionCookies() throws Exception {
        User user = new User();
        user.setName("Conta de teste");
        user.setEmail("login-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        userRepository.saveAndFlush(user);

        MvcResult unknownEmail = login("unknown-" + UUID.randomUUID() + "@example.com", "correct-password");
        MvcResult wrongPassword = login(user.getEmail(), "wrong-password");

        assertThat(unknownEmail.getResponse().getStatus()).isEqualTo(wrongPassword.getResponse().getStatus());
        assertThat(unknownEmail.getResponse().getStatus()).isEqualTo(401);
        assertThat(stableErrorFields(unknownEmail)).isEqualTo(stableErrorFields(wrongPassword));
        assertThat(refreshTokenRepository.findAll()).isEmpty();
    }

    private Map<String, Object> stableErrorFields(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return Map.of(
                "status", body.path("status").asInt(),
                "error", body.path("error").asText(),
                "message", body.path("message").asText(),
                "path", body.path("path").asText());
    }

    private MvcResult login(String email, String password) throws Exception {
        return mockMvc.perform(post("/auth/login")
                        .with(uniqueRemoteAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "%s", "password": "%s" }
                                """.formatted(email, password)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(INVALID_CREDENTIALS_MESSAGE))
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andReturn();
    }

    private RequestPostProcessor uniqueRemoteAddress() {
        return request -> {
            request.setRemoteAddr(UUID.randomUUID().toString());
            return request;
        };
    }
}
