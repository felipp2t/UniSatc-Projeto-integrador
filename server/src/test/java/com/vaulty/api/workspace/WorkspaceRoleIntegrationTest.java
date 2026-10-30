package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.repository.NotificationRepository;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

class WorkspaceRoleIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private ObjectMapper objectMapper;
    @Autowired private NotificationRepository notificationRepository;

    @Test
    void ownerListsRolesWithProtectionAndMemberCount() throws Exception {
        User owner = createUser();
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());

        mockMvc.perform(get(roles(workspace.id())).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'Owner' && @.builtIn == true && @.memberCount == 1)]")
                        .isNotEmpty())
                .andExpect(jsonPath("$[?(@.name == 'Member' && @.builtIn == true && @.memberCount == 1)]")
                        .isNotEmpty());
    }

    @Test
    void memberWithoutOwnerRoleCannotManageRoles() throws Exception {
        User owner = createUser();
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());
        UUID roleId = createRole(owner, workspace.id(), "Financeiro");

        mockMvc.perform(get(roles(workspace.id())).cookie(authCookie(member)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(roles(workspace.id())).cookie(authCookie(member))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Negado\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(permissions(workspace.id(), roleId)).cookie(authCookie(member)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete(role(workspace.id(), roleId)).cookie(authCookie(member)))
                .andExpect(status().isForbidden());
    }

    @Test
    void secondMemberWithOwnerRoleIsTreatedAsOwner() throws Exception {
        User owner = createUser();
        User coOwner = createUser("Co-dono");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(coOwner, workspace.id());
        assignRole(coOwner, workspace.id(), WorkspaceRole.OWNER_ROLE_NAME);

        mockMvc.perform(get(roles(workspace.id())).cookie(authCookie(coOwner)))
                .andExpect(status().isOk());
    }

    @Test
    void unknownWorkspaceReturnsNotFound() throws Exception {
        User owner = createUser();
        configureWorkspace(owner);

        mockMvc.perform(get(roles(UUID.randomUUID())).cookie(authCookie(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void createsRoleWithoutPermissionsAndRecordsActivity() throws Exception {
        User owner = createUser();
        WorkspaceResponse workspace = configureWorkspace(owner);

        UUID roleId = createRole(owner, workspace.id(), "  Financeiro  ");

        mockMvc.perform(get(roles(workspace.id())).cookie(authCookie(owner)))
                .andExpect(jsonPath("$[?(@.id == '%s' && @.name == 'Financeiro' && @.builtIn == false)]"
                        .formatted(roleId)).isNotEmpty());
        mockMvc.perform(get(permissions(workspace.id(), roleId)).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        assertThat(activityCount("role_created", owner)).isEqualTo(1);
    }

    @Test
    void rejectsBlankLongAndNormalizedDuplicateNames() throws Exception {
        User owner = createUser();
        WorkspaceResponse workspace = configureWorkspace(owner);
        createRole(owner, workspace.id(), "Café");

        mockMvc.perform(post(roles(workspace.id())).cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(roles(workspace.id())).cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "a".repeat(51)))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(roles(workspace.id())).cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" CAFE \"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void customRoleCannotReuseBuiltInNameWithDifferentCase() throws Exception {
        User owner = createUser();
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(post(roles(workspace.id())).cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"owner\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void permissionsExpandAllAndOwnerRoleHasFullCatalog() throws Exception {
        User owner = createUser();
        WorkspaceResponse workspace = configureWorkspace(owner);
        UUID roleId = createRole(owner, workspace.id(), "Auditor");
        grant(roleId, "activity", "read");
        grant(roleId, "item", "all");

        mockMvc.perform(get(permissions(workspace.id(), roleId)).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[?(@.resource == 'activity' && @.action == 'read')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.resource == 'item' && @.action == 'delete')]").isNotEmpty());

        UUID ownerRoleId = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspace.id(), WorkspaceRole.OWNER_ROLE_NAME).orElseThrow().getId();
        mockMvc.perform(get(permissions(workspace.id(), ownerRoleId)).cookie(authCookie(owner)))
                .andExpect(jsonPath("$[?(@.resource == 'group' && @.action == 'manage')]").isNotEmpty());
        mockMvc.perform(get(permissions(workspace.id(), UUID.randomUUID())).cookie(authCookie(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletesUnusedCustomRoleWithItsPermissionsAndRecordsActivity() throws Exception {
        User owner = createUser();
        WorkspaceResponse workspace = configureWorkspace(owner);
        UUID roleId = createRole(owner, workspace.id(), "Temporário");
        grant(roleId, "item", "read");

        mockMvc.perform(delete(role(workspace.id(), roleId)).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());

        assertThat(workspaceRoleRepository.findById(roleId)).isEmpty();
        assertThat(rolePermissionRepository.findAllByRoleId(roleId)).isEmpty();
        assertThat(activityCount("role_deleted", owner)).isEqualTo(1);
        mockMvc.perform(delete(role(workspace.id(), roleId)).cookie(authCookie(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void cannotDeleteRoleInUseOrBuiltInRoles() throws Exception {
        User owner = createUser();
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());
        UUID roleId = createRole(owner, workspace.id(), "Financeiro");
        changeRole(owner, workspace.id(), memberId(member, workspace.id()), roleId).andExpect(status().isOk());

        mockMvc.perform(delete(role(workspace.id(), roleId)).cookie(authCookie(owner)))
                .andExpect(status().isConflict());
        for (String builtIn : new String[] {WorkspaceRole.OWNER_ROLE_NAME, WorkspaceRole.MEMBER_ROLE_NAME}) {
            UUID builtInId = workspaceRoleRepository.findByWorkspaceIdAndName(workspace.id(), builtIn)
                    .orElseThrow().getId();
            mockMvc.perform(delete(role(workspace.id(), builtInId)).cookie(authCookie(owner)))
                    .andExpect(status().isConflict());
        }
    }

    @Test
    void ownerChangesMemberRoleRecordsActivityAndNotifiesMember() throws Exception {
        User owner = createUser();
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());
        UUID roleId = createRole(owner, workspace.id(), "Financeiro");

        changeRole(owner, workspace.id(), memberId(member, workspace.id()), roleId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roleId").value(roleId.toString()))
                .andExpect(jsonPath("$.roleName").value("Financeiro"));

        assertThat(activityCount("member_role_changed", owner)).isEqualTo(1);
        assertThat(notificationRepository.findAllByRecipientId(member.getId(), Pageable.unpaged())
                .getTotalElements()).isEqualTo(1);
    }

    @Test
    void nonOwnerCannotChangeRoles() throws Exception {
        User owner = createUser();
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());
        UUID ownerRoleId = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspace.id(), WorkspaceRole.OWNER_ROLE_NAME).orElseThrow().getId();

        changeRole(member, workspace.id(), memberId(member, workspace.id()), ownerRoleId)
                .andExpect(status().isForbidden());
    }

    @Test
    void lastOwnerCannotBeDemotedButOneOfTwoOwnersCan() throws Exception {
        User owner = createUser();
        User coOwner = createUser("Co-dono");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(coOwner, workspace.id());
        UUID ownerRoleId = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspace.id(), WorkspaceRole.OWNER_ROLE_NAME).orElseThrow().getId();
        UUID memberRoleId = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspace.id(), WorkspaceRole.MEMBER_ROLE_NAME).orElseThrow().getId();

        changeRole(owner, workspace.id(), memberId(owner, workspace.id()), memberRoleId)
                .andExpect(status().isConflict());

        changeRole(owner, workspace.id(), memberId(coOwner, workspace.id()), ownerRoleId)
                .andExpect(status().isOk());
        changeRole(coOwner, workspace.id(), memberId(owner, workspace.id()), memberRoleId)
                .andExpect(status().isOk());
        changeRole(coOwner, workspace.id(), memberId(coOwner, workspace.id()), memberRoleId)
                .andExpect(status().isConflict());
    }

    @Test
    void unknownMemberOrRoleReturnsNotFound() throws Exception {
        User owner = createUser();
        WorkspaceResponse workspace = configureWorkspace(owner);
        UUID roleId = createRole(owner, workspace.id(), "Financeiro");

        changeRole(owner, workspace.id(), UUID.randomUUID(), roleId).andExpect(status().isNotFound());
        changeRole(owner, workspace.id(), memberId(owner, workspace.id()), UUID.randomUUID())
                .andExpect(status().isNotFound());
    }

    private UUID createRole(User owner, UUID workspaceId, String name) throws Exception {
        MvcResult result = mockMvc.perform(post(roles(workspaceId)).cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name))))
                .andExpect(status().isCreated()).andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }

    private ResultActions changeRole(
            User actor, UUID workspaceId, UUID memberId, UUID roleId) throws Exception {
        return mockMvc.perform(put("/workspaces/%s/members/%s/role".formatted(workspaceId, memberId))
                .cookie(authCookie(actor)).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("roleId", roleId))));
    }

    private void grant(UUID roleId, String resource, String action) {
        jdbcTemplate.update("INSERT INTO role_permission (role_id, resource, action) VALUES (?, ?, ?)",
                roleId, resource, action);
    }

    private UUID memberId(User user, UUID workspaceId) {
        return workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, user.getId()).orElseThrow().getId();
    }

    private long activityCount(String action, User actor) {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM activity_log WHERE action = ? AND actor_id = ?",
                Long.class, action, actor.getId());
    }

    private String roles(UUID workspaceId) {
        return "/workspaces/%s/roles".formatted(workspaceId);
    }

    private String role(UUID workspaceId, UUID roleId) {
        return roles(workspaceId) + "/" + roleId;
    }

    private String permissions(UUID workspaceId, UUID roleId) {
        return role(workspaceId, roleId) + "/permissions";
    }
}
