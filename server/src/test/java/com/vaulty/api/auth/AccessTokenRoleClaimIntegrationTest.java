package com.vaulty.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.UserInvite;
import com.vaulty.api.entity.RolePermission;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.repository.UserInviteRepository;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.repository.RolePermissionRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import com.vaulty.api.service.JwtService;
import jakarta.persistence.EntityManager;
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
    @Autowired private RolePermissionRepository rolePermissionRepository;
    @Autowired private EntityManager entityManager;

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
        var claims = jwtService.validateAccessToken(accessToken).orElseThrow();
        assertThat(claims.membershipId()).isEqualTo(workspaceMemberRepository
                .findByUserId(userRepository.findByEmail(ADMIN_EMAIL).orElseThrow().getId()).orElseThrow().getId());
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
        User registered = userRepository.findByEmail("colaborador@example.com").orElseThrow();
        assertThat(jwtService.validateAccessToken(accessToken).orElseThrow().membershipId())
                .isEqualTo(workspaceMemberRepository.findByUserId(registered.getId()).orElseThrow().getId());
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

    @Test
    @Transactional
    void oldAccessTokenStaysUnauthorizedAfterMembershipIsDeletedAndRecreated() throws Exception {
        MvcResult login = loginAsAdmin();
        User user = userRepository.findByEmail(ADMIN_EMAIL).orElseThrow();
        var oldMember = workspaceMemberRepository.findByUserId(user.getId()).orElseThrow();
        String accessToken = login.getResponse().getCookie("accessToken").getValue();
        var refreshCookie = login.getResponse().getCookie("refreshToken");

        workspaceMemberRepository.delete(oldMember);
        workspaceMemberRepository.flush();
        entityManager.clear();
        mockMvc.perform(get("/me").cookie(login.getResponse().getCookie("accessToken")))
                .andExpect(status().isUnauthorized());

        var newMember = new com.vaulty.api.entity.WorkspaceMember();
        newMember.setUser(user);
        newMember.setWorkspace(oldMember.getWorkspace());
        newMember.setRole(oldMember.getRole());
        newMember = workspaceMemberRepository.saveAndFlush(newMember);
        assertThat(newMember.getId()).isNotEqualTo(oldMember.getId());
        mockMvc.perform(get("/me").cookie(new jakarta.servlet.http.Cookie("accessToken", accessToken)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/auth/refresh").cookie(refreshCookie))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void currentMembershipRoleOverridesAnOldHigherPermissionClaim() throws Exception {
        var ownerMembership = workspaceMemberRepository.findByUserId(
                userRepository.findByEmail(ADMIN_EMAIL).orElseThrow().getId()).orElseThrow();
        var workspace = ownerMembership.getWorkspace();
        User user = new User();
        user.setName("Role Downgrade");
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash("unused-test-password-hash");
        userRepository.saveAndFlush(user);

        WorkspaceRole previousRole = new WorkspaceRole();
        previousRole.setWorkspace(workspace);
        previousRole.setName("TemporaryManager");
        previousRole = workspaceRoleRepository.saveAndFlush(previousRole);
        RolePermission createCollection = new RolePermission();
        createCollection.setRole(previousRole);
        createCollection.setResource("collection");
        createCollection.setAction("create");
        rolePermissionRepository.saveAndFlush(createCollection);

        WorkspaceMember membership = new WorkspaceMember();
        membership.setUser(user);
        membership.setWorkspace(workspace);
        membership.setRole(previousRole);
        membership = workspaceMemberRepository.saveAndFlush(membership);
        String accessToken = jwtService.generateAccessToken(user.getId(), membership.getId(), "TemporaryManager");

        var memberRole = workspaceRoleRepository.findByWorkspaceIdAndName(
                workspace.getId(), WorkspaceRole.MEMBER_ROLE_NAME).orElseThrow();
        membership.setRole(memberRole);
        workspaceMemberRepository.saveAndFlush(membership);

        mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspace.getId())
                        .cookie(new jakarta.servlet.http.Cookie("accessToken", accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"forbidden\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void refreshTokenIssuedForActiveMembershipCanBeRefreshed() throws Exception {
        MvcResult login = loginAsAdmin();
        mockMvc.perform(post("/auth/refresh").cookie(login.getResponse().getCookie("refreshToken")))
                .andExpect(status().isOk());
    }

    private MvcResult loginAsAdmin() throws Exception {
        return mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "%s", "password": "%s" }
                                """.formatted(ADMIN_EMAIL, ADMIN_PASSWORD)))
                .andExpect(status().isOk()).andReturn();
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
