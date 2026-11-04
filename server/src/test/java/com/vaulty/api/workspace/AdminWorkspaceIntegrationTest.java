package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.UserInvite;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.repository.UserInviteRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class AdminWorkspaceIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private UserInviteRepository userInviteRepository;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void createsAWorkspaceWithTheDefaultRoles() throws Exception {
        UUID workspaceId = createWorkspace("Equipe Financeira");

        var workspace = workspaceRepository.findById(workspaceId).orElseThrow();
        assertThat(workspace.getOwner()).isNull();
        assertThat(workspaceRoleRepository.findByWorkspaceIdAndName(workspaceId, WorkspaceRole.OWNER_ROLE_NAME))
                .isPresent();
        WorkspaceRole memberRole = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspaceId, WorkspaceRole.MEMBER_ROLE_NAME).orElseThrow();
        assertThat(rolePermissionRepository.findAllByRoleId(memberRole.getId()))
                .extracting(permission -> permission.getResource() + ":" + permission.getAction())
                .containsExactlyInAnyOrder("item:read", "collection:read");
    }

    @Test
    void listsEveryWorkspaceWithItsPendingInvites() throws Exception {
        UUID workspaceId = createWorkspace("Equipe Comercial");
        invite(workspaceId, "lider@example.com", true);

        mockMvc.perform(get("/admin/workspaces").cookie(authCookie(admin())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[1].name").value("Equipe Comercial"))
                .andExpect(jsonPath("$[1].memberCount").value(0))
                .andExpect(jsonPath("$[1].pendingInvites[0].email").value("lider@example.com"))
                .andExpect(jsonPath("$[1].pendingInvites[0].owner").value(true));
    }

    @Test
    void ownerInviteMakesTheNewAccountTheWorkspaceOwner() throws Exception {
        UUID workspaceId = createWorkspace("Equipe de Suporte");
        invite(workspaceId, "lider@example.com", true);

        WorkspaceMember membership = register("lider@example.com");

        assertThat(membership.getWorkspace().getId()).isEqualTo(workspaceId);
        assertThat(membership.getRole().getName()).isEqualTo(WorkspaceRole.OWNER_ROLE_NAME);
        assertThat(workspaceRepository.findById(workspaceId).orElseThrow().getOwner().getId())
                .isEqualTo(membership.getUser().getId());
    }

    @Test
    void memberInviteAddsTheNewAccountAsARegularMember() throws Exception {
        UUID workspaceId = createWorkspace("Equipe de Marketing");
        invite(workspaceId, "membro@example.com", false);

        WorkspaceMember membership = register("membro@example.com");

        assertThat(membership.getWorkspace().getId()).isEqualTo(workspaceId);
        assertThat(membership.getRole().getName()).isEqualTo(WorkspaceRole.MEMBER_ROLE_NAME);
        assertThat(workspaceRepository.findById(workspaceId).orElseThrow().getOwner()).isNull();
    }

    @Test
    void rejectsInvitesForEmailsThatAlreadyHaveAnAccount() throws Exception {
        UUID workspaceId = createWorkspace("Equipe Jurídica");
        User existing = createUser();

        mockMvc.perform(post("/admin/workspaces/{workspaceId}/invites", workspaceId)
                        .cookie(authCookie(admin()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "%s", "owner": false }
                                """.formatted(existing.getEmail())))
                .andExpect(status().isConflict());
    }

    @Test
    void ownersOnlySeeAndRevokeInvitesOfTheirOwnWorkspace() throws Exception {
        UUID otherWorkspaceId = createWorkspace("Outra equipe");
        invite(otherWorkspaceId, "externo@example.com", false);
        UserInvite otherInvite = userInviteRepository.findAll().get(0);
        User owner = createUser();
        configureWorkspace(owner);

        mockMvc.perform(get("/invites").cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(post("/invites/{id}/revoke", otherInvite.getId()).cookie(authCookie(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsAdministrationForUsersWhoAreNotSystemAdmins() throws Exception {
        User owner = createUser();
        configureWorkspace(owner);

        mockMvc.perform(get("/admin/workspaces").cookie(authCookie(owner)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/admin/workspaces")
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "name": "Equipe indevida" }
                                """))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/workspaces/backup").cookie(authCookie(owner)))
                .andExpect(status().isForbidden());
    }

    @Test
    void exposesTheSystemAdminFlagOnTheCurrentUser() throws Exception {
        mockMvc.perform(get("/me").cookie(authCookie(admin())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.systemAdmin").value(true));
    }

    private UUID createWorkspace(String name) throws Exception {
        String response = mockMvc.perform(post("/admin/workspaces")
                        .cookie(authCookie(admin()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "name": "%s" }
                                """.formatted(name)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(response).get("id").asText());
    }

    private void invite(UUID workspaceId, String email, boolean owner) throws Exception {
        mockMvc.perform(post("/admin/workspaces/{workspaceId}/invites", workspaceId)
                        .cookie(authCookie(admin()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "%s", "owner": %s }
                                """.formatted(email, owner)))
                .andExpect(status().isCreated());
    }

    private WorkspaceMember register(String email) throws Exception {
        UserInvite invite = userInviteRepository.findAll().stream()
                .filter(candidate -> candidate.getEmail().equals(email))
                .findFirst().orElseThrow();
        mockMvc.perform(post("/auth/register")
                        .with(request -> {
                            request.setRemoteAddr(UUID.randomUUID().toString());
                            return request;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "token": "%s",
                                  "name": "Pessoa Convidada",
                                  "password": "password123",
                                  "confirmPassword": "password123"
                                }
                                """.formatted(email, invite.getToken())))
                .andExpect(status().isOk());
        User user = userRepository.findByEmail(email).orElseThrow();
        return workspaceMemberRepository.findByUserId(user.getId()).orElseThrow();
    }

    private User admin() {
        return userRepository.findByEmail("admin@gmail.com").orElseThrow();
    }
}
