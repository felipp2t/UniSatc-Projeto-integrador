package com.vaulty.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.UserInvite;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.repository.UserInviteRepository;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import com.vaulty.api.service.JwtService;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@AutoConfigureMockMvc
class AccessTokenRoleClaimIntegrationTest extends PostgresIntegrationTest {

    private static final String ADMIN_EMAIL = "admin@gmail.com";
    private static final String ADMIN_PASSWORD = "admin_pass";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private UserInviteRepository userInviteRepository;
    @Autowired private JwtService jwtService;
    @Autowired private WorkspaceMemberRepository workspaceMemberRepository;
    @Autowired private WorkspaceRoleRepository workspaceRoleRepository;

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

        assertThat(jwtService.validateAccessToken(accessToken).map(JwtService.AccessTokenClaims::role))
                .contains(WorkspaceRole.OWNER_ROLE_NAME);
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

        assertThat(jwtService.validateAccessToken(accessToken).map(JwtService.AccessTokenClaims::role))
                .contains(WorkspaceRole.MEMBER_ROLE_NAME);
    }

    @Test
    @Transactional
    void refreshRecalculatesTheRoleFromTheCurrentMembership() throws Exception {
        MvcResult login = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "%s", "password": "%s" }
                                """.formatted(ADMIN_EMAIL, ADMIN_PASSWORD)))
                .andExpect(status().isOk()).andReturn();
        User owner = userRepository.findByEmail(ADMIN_EMAIL).orElseThrow();
        var membership = workspaceMemberRepository.findByUserId(owner.getId()).orElseThrow();
        var memberRole = workspaceRoleRepository.findByWorkspaceIdAndName(
                membership.getWorkspace().getId(), WorkspaceRole.MEMBER_ROLE_NAME).orElseThrow();
        membership.setRole(memberRole);
        workspaceMemberRepository.saveAndFlush(membership);

        MvcResult refresh = mockMvc.perform(post("/auth/refresh")
                        .cookie(login.getResponse().getCookie("refreshToken")))
                .andExpect(status().isOk()).andReturn();
        String accessToken = refresh.getResponse().getCookie("accessToken").getValue();
        assertThat(jwtService.validateAccessToken(accessToken).map(JwtService.AccessTokenClaims::role))
                .contains(WorkspaceRole.MEMBER_ROLE_NAME);
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
