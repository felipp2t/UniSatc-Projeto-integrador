package com.vaulty.api.workspace;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.RolePermission;
import com.vaulty.api.entity.WorkspaceRole;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.junit.jupiter.api.Test;

class WorkspaceMemberIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private EntityManager entityManager;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void ownerGetsEveryActionForEveryResource() throws Exception {
        User owner = createUser("Proprietário");
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id()).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isOwner").value(true))
                .andExpect(jsonPath("$.roleName").value("Owner"))
                .andExpect(jsonPath("$.permissions.length()").value(30));
    }

    @Test
    void memberGetsOnlyRolePermissions() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());

        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id()).cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isOwner").value(false))
                .andExpect(jsonPath("$.roleName").value("Member"))
                .andExpect(jsonPath("$.permissions.length()").value(2))
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'read')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.action == 'create')]").isEmpty());
    }

    @Test
    void allPermissionExpandsToEveryActionForResource() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        WorkspaceRole role = new WorkspaceRole();
        role.setWorkspace(workspaceRepository.findById(workspace.id()).orElseThrow());
        role.setName("Manager");
        role = workspaceRoleRepository.saveAndFlush(role);
        RolePermission permission = new RolePermission();
        permission.setRole(role);
        permission.setResource("collection");
        permission.setAction("all");
        rolePermissionRepository.saveAndFlush(permission);
        addMember(member, workspace.id());
        var membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace.id(), member.getId())
                .orElseThrow();
        membership.setRole(role);
        workspaceMemberRepository.saveAndFlush(membership);

        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id()).cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions.length()").value(5))
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'read')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'create')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'update')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'delete')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'invite')]").isNotEmpty());
    }

    @Test
    void userWithoutMembershipGetsNotFoundAndAnonymousGetsUnauthorized() throws Exception {
        User owner = createUser("Proprietário");
        User unrelated = createUser("Externo");
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id()).cookie(authCookie(unrelated)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ownerListsMembersWithUserAndRoleData() throws Exception {
        User owner = createUser("Proprietário");
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/members", workspace.id()).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").isString())
                .andExpect(jsonPath("$[0].userId").value(owner.getId().toString()))
                .andExpect(jsonPath("$[0].name").value("Proprietário"))
                .andExpect(jsonPath("$[0].email").value(owner.getEmail()))
                .andExpect(jsonPath("$[0].roleId").isString())
                .andExpect(jsonPath("$[0].roleName").value("Owner"));
    }

    @Test
    void nonOwnerMemberCanListWorkspaceMembers() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());

        mockMvc.perform(get("/workspaces/{workspaceId}/members", workspace.id()).cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void nonOwnerSeesMemberNamesAndRolesButNoEmailIncludingTheirOwn() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());

        String response = mockMvc.perform(get("/workspaces/{workspaceId}/members", workspace.id())
                        .cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Map<String, Object>> members = objectMapper.readValue(response, new TypeReference<>() {});

        assertThat(members).hasSize(2).allSatisfy(memberJson -> {
            assertThat(memberJson).containsKeys("userId", "name", "roleName").doesNotContainKey("email");
        });
        assertThat(members).anySatisfy(memberJson -> assertThat(memberJson)
                .containsEntry("userId", owner.getId().toString())
                .containsEntry("name", "Proprietário")
                .containsEntry("roleName", "Owner"));
        assertThat(members).anySatisfy(memberJson -> assertThat(memberJson)
                .containsEntry("userId", member.getId().toString())
                .containsEntry("name", "Membro")
                .containsEntry("roleName", "Member"));
    }

    @Test
    void memberEmailVisibilityFollowsCurrentDatabaseOwnerInsteadOfJwtRoleClaim() throws Exception {
        User formerOwner = createUser("Proprietário anterior");
        User currentOwner = createUser("Novo proprietário");
        WorkspaceResponse workspaceResponse = configureWorkspace(formerOwner);
        addMember(currentOwner, workspaceResponse.id());
        var formerOwnerCookie = authCookie(formerOwner);

        var workspace = workspaceRepository.findById(workspaceResponse.id()).orElseThrow();
        workspace.setOwner(currentOwner);
        workspaceRepository.saveAndFlush(workspace);
        entityManager.clear();

        String formerOwnerResponse = mockMvc.perform(get("/workspaces/{workspaceId}/members", workspaceResponse.id())
                        .cookie(formerOwnerCookie))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Map<String, Object>> formerOwnerMembers = objectMapper.readValue(
                formerOwnerResponse, new TypeReference<>() {});
        assertThat(formerOwnerMembers).hasSize(2).allSatisfy(memberJson ->
                assertThat(memberJson).doesNotContainKey("email"));

        String currentOwnerResponse = mockMvc.perform(get("/workspaces/{workspaceId}/members", workspaceResponse.id())
                        .cookie(authCookie(currentOwner)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Map<String, Object>> currentOwnerMembers = objectMapper.readValue(
                currentOwnerResponse, new TypeReference<>() {});
        assertThat(currentOwnerMembers).hasSize(2).allSatisfy(memberJson ->
                assertThat(memberJson).containsKey("email"));
        assertThat(currentOwnerMembers).anySatisfy(memberJson -> assertThat(memberJson)
                .containsEntry("userId", currentOwner.getId().toString())
                .containsEntry("email", currentOwner.getEmail()));
    }

    @Test
    void userWithoutMembershipCannotListWorkspaceMembers() throws Exception {
        User owner = createUser("Proprietário");
        User unrelatedUser = createUser("Usuário externo");
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/members", workspace.id())
                        .cookie(authCookie(unrelatedUser)))
                .andExpect(status().isNotFound());
    }

    @Test
    void unauthenticatedUserCannotListWorkspaceMembers() throws Exception {
        mockMvc.perform(get("/workspaces/{workspaceId}/members", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }
}
