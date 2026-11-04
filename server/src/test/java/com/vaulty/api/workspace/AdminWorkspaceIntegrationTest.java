package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.UserInvite;
import com.vaulty.api.entity.UserInviteStatus;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.repository.UserInviteRepository;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

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
        mockMvc.perform(get("/admin/workspaces/{workspaceId}", UUID.randomUUID()).cookie(authCookie(owner)))
                .andExpect(status().isForbidden());
    }

    @Test
    void detailsAWorkspaceWithItsMembersAndPendingInvites() throws Exception {
        UUID workspaceId = createWorkspace("Equipe de Dados");
        invite(workspaceId, "lider@example.com", true);
        register("lider@example.com");
        invite(workspaceId, "analista@example.com", false);

        mockMvc.perform(get("/admin/workspaces/{workspaceId}", workspaceId).cookie(authCookie(admin())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workspace.name").value("Equipe de Dados"))
                .andExpect(jsonPath("$.workspace.ownerEmail").value("lider@example.com"))
                .andExpect(jsonPath("$.members.length()").value(1))
                .andExpect(jsonPath("$.members[0].email").value("lider@example.com"))
                .andExpect(jsonPath("$.members[0].roleName").value(WorkspaceRole.OWNER_ROLE_NAME))
                .andExpect(jsonPath("$.workspace.pendingInvites[0].email").value("analista@example.com"));
    }

    @Test
    void updatesTheNameAndDescriptionOfAnyWorkspace() throws Exception {
        UUID workspaceId = createWorkspace("Nome antigo");

        mockMvc.perform(put("/admin/workspaces/{workspaceId}", workspaceId)
                        .cookie(authCookie(admin()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "name": "  Nome novo  ", "description": "Equipe renomeada" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Nome novo"))
                .andExpect(jsonPath("$.description").value("Equipe renomeada"));
    }

    @Test
    void revokesAPendingInviteOfTheWorkspace() throws Exception {
        UUID workspaceId = createWorkspace("Equipe de Vendas");
        invite(workspaceId, "vendedor@example.com", false);
        UserInvite pending = userInviteRepository.findAll().get(0);

        mockMvc.perform(post("/admin/workspaces/{workspaceId}/invites/{inviteId}/revoke", workspaceId, pending.getId())
                        .cookie(authCookie(admin())))
                .andExpect(status().isNoContent());

        assertThat(userInviteRepository.findById(pending.getId()).orElseThrow().getStatus())
                .isEqualTo(UserInviteStatus.REVOKED);
    }

    @Test
    void doesNotRevokeAnInviteThroughAnotherWorkspace() throws Exception {
        UUID workspaceId = createWorkspace("Equipe A");
        UUID otherWorkspaceId = createWorkspace("Equipe B");
        invite(workspaceId, "pessoa@example.com", false);
        UserInvite pending = userInviteRepository.findAll().get(0);

        mockMvc.perform(post("/admin/workspaces/{workspaceId}/invites/{inviteId}/revoke",
                        otherWorkspaceId, pending.getId())
                        .cookie(authCookie(admin())))
                .andExpect(status().isNotFound());
    }

    @Test
    void systemAdminWithoutMembershipReadsAndManagesAnyWorkspace() throws Exception {
        UUID workspaceId = createWorkspace("Equipe Segura");
        invite(workspaceId, "lider@example.com", true);
        User leader = register("lider@example.com").getUser();
        String secretId = objectMapper.readTree(mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(leader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "type": "secret", "title": "Senha do banco", "value": "s3nh4-forte" }
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asText();
        jdbcTemplate.update("DELETE FROM workspace_member WHERE user_id = ?", admin().getId());

        Cookie[] session = login("admin@gmail.com", "admin_pass");
        Cookie access = session[0];

        assertThat(session[1]).as("sessão renovável do administrador geral").isNotNull();
        mockMvc.perform(get("/workspaces").cookie(access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspaceId).cookie(access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isOwner").value(true));
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId).cookie(access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Senha do banco"));
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, secretId).cookie(access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("s3nh4-forte"));
        mockMvc.perform(get("/workspaces/{workspaceId}/members", workspaceId).cookie(access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("lider@example.com"));
        mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(access)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "name": "Criada pelo admin" }
                                """))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/auth/refresh").with(uniqueAddress()).cookie(session[1]))
                .andExpect(status().isOk());
    }

    @Test
    void detachMigrationRemovesTheSystemAdminAndPromotesAnotherOwner() throws Exception {
        UUID seedWorkspaceId = workspaceRepository.findFirstByOrderByCreatedAtAscIdAsc().orElseThrow().getId();
        UUID emptyWorkspaceId = createWorkspace("Sem outro dono");
        jdbcTemplate.update("UPDATE workspace SET owner_id = ? WHERE id = ?", admin().getId(), emptyWorkspaceId);
        User coOwner = createUser("Segundo dono");
        addMember(coOwner, seedWorkspaceId);
        assignRole(coOwner, seedWorkspaceId, WorkspaceRole.OWNER_ROLE_NAME);

        try (var sql = new ClassPathResource("db/migration/V31__detach_system_admin_from_workspaces.sql")
                .getInputStream()) {
            jdbcTemplate.execute(new String(sql.readAllBytes(), StandardCharsets.UTF_8));
        }

        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM workspace_member WHERE user_id = ?", Integer.class, admin().getId())).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT owner_id FROM workspace WHERE id = ?", UUID.class, seedWorkspaceId)).isEqualTo(coOwner.getId());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT owner_id FROM workspace WHERE id = ?", UUID.class, emptyWorkspaceId)).isNull();
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

    private Cookie[] login(String email, String password) throws Exception {
        var response = mockMvc.perform(post("/auth/login")
                        .with(uniqueAddress())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "%s", "password": "%s" }
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        return new Cookie[] {response.getCookie("accessToken"), response.getCookie("refreshToken")};
    }

    private RequestPostProcessor uniqueAddress() {
        return request -> {
            request.setRemoteAddr(UUID.randomUUID().toString());
            return request;
        };
    }
}
