package com.rootly.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rootly.api.PostgresIntegrationTest;
import com.rootly.api.entity.User;
import com.rootly.api.entity.UserInvite;
import com.rootly.api.entity.WorkspaceRole;
import com.rootly.api.repository.UserInviteRepository;
import com.rootly.api.repository.UserRepository;
import com.rootly.api.service.JwtService;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@AutoConfigureMockMvc
class AccessTokenRoleClaimIntegrationTest extends PostgresIntegrationTest {

    private static final String ADMIN_EMAIL = "admin@gmail.com";
    private static final String ADMIN_PASSWORD = "admin_pass";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private UserInviteRepository userInviteRepository;
    @Autowired private JwtService jwtService;

    @AfterEach
    void cleanUp() {
        userInviteRepository.deleteAll();
        userRepository.deleteAllByEmailNot(ADMIN_EMAIL);
    }

    @Test
    void loginAsOwnerEmbedsTheOwnerRoleInTheAccessToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "%s", "password": "%s" }
                                """.formatted(ADMIN_EMAIL, ADMIN_PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();

        String accessToken = result.getResponse().getCookie("accessToken").getValue();

        assertThat(jwtService.extractRole(accessToken)).contains(WorkspaceRole.OWNER_ROLE_NAME);
    }

    @Test
    void registeringThroughAnInviteEmbedsTheMemberRoleInTheAccessToken() throws Exception {
        UserInvite invite = createInvite("colaborador@example.com");

        MvcResult result = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "colaborador@example.com",
                                  "token": "%s",
                                  "name": "Colaborador",
                                  "password": "password123",
                                  "confirmPassword": "password123"
                                }
                                """.formatted(invite.getToken())))
                .andExpect(status().isOk())
                .andReturn();

        String accessToken = result.getResponse().getCookie("accessToken").getValue();

        assertThat(jwtService.extractRole(accessToken)).contains(WorkspaceRole.MEMBER_ROLE_NAME);
    }

    private UserInvite createInvite(String email) {
        User admin = userRepository.findByEmail(ADMIN_EMAIL).orElseThrow();

        UserInvite invite = new UserInvite();
        invite.setEmail(email);
        invite.setToken(UUID.randomUUID().toString());
        invite.setInvitedBy(admin);
        invite.setExpiresAt(OffsetDateTime.now().plusDays(7));
        return userInviteRepository.save(invite);
    }
}
