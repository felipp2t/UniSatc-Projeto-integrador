package com.vaulty.api.workspace;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.entity.RolePermission;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.WorkspaceRole;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

class AccessGroupIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private ObjectMapper objectMapper;

    @Test
    void ownerCanManageGroupsButDefaultMemberCannot() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());

        mockMvc.perform(get(groups(workspace.id())).cookie(authCookie(owner)))
                .andExpect(status().isOk());
        mockMvc.perform(post(groups(workspace.id())).cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Financeiro\"}"))
                .andExpect(status().isCreated());
        mockMvc.perform(get(groups(workspace.id())).cookie(authCookie(member)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(groups(workspace.id())).cookie(authCookie(member))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Negado\"}"))
                .andExpect(status().isForbidden());

        grant(member, workspace.id(), "group", "manage");
        mockMvc.perform(post(groups(workspace.id())).cookie(authCookie(member))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Delegado\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void trimsNamesRejectsBlankAndLongNamesAndDetectsNormalizedDuplicateOnCreate() throws Exception {
        User owner = createUser();
        WorkspaceResponse workspace = configureWorkspace(owner);
        UUID first = createGroup(owner, workspace.id(), "  Café Team  ");

        mockMvc.perform(get(groups(workspace.id())).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '%s' && @.name == 'Café Team')]".formatted(first)).isNotEmpty());
        mockMvc.perform(post(groups(workspace.id())).cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(groups(workspace.id())).cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("name", "a".repeat(51)))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(groups(workspace.id())).cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"cafe team\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void renamingToNormalizedDuplicateNameReturnsConflict() throws Exception {
        User owner = createUser();
        WorkspaceResponse workspace = configureWorkspace(owner);
        createGroup(owner, workspace.id(), "Café Team");
        UUID second = createGroup(owner, workspace.id(), "Operations");

        mockMvc.perform(put(group(workspace.id(), second)).cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"CAFÉ TEAM\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void currentMembersAreIdempotentCanBelongToSeveralGroupsAndKeepWorkspaceRole() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());
        UUID firstGroup = createGroup(owner, workspace.id(), "First");
        UUID secondGroup = createGroup(owner, workspace.id(), "Second");
        var workspaceMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace.id(), member.getId())
                .orElseThrow();
        UUID workspaceMemberId = workspaceMembership.getId();
        UUID roleId = workspaceMembership.getRole().getId();

        mockMvc.perform(put(groupMember(workspace.id(), firstGroup, workspaceMemberId)).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(put(groupMember(workspace.id(), firstGroup, workspaceMemberId)).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(put(groupMember(workspace.id(), secondGroup, workspaceMemberId)).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get(groupMembers(workspace.id(), firstGroup)).cookie(authCookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(delete(groupMember(workspace.id(), firstGroup, workspaceMemberId)).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete(groupMember(workspace.id(), firstGroup, workspaceMemberId)).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get(groupMembers(workspace.id(), firstGroup)).cookie(authCookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get(groupMembers(workspace.id(), secondGroup)).cookie(authCookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        var unchangedMembership = workspaceMemberRepository.findById(workspaceMemberId).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(unchangedMembership.getRole().getId()).isEqualTo(roleId);
    }

    @Test
    void renamingPreservesMembershipAndDeletingWithMembersDoesNotCascade() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());
        UUID groupId = createGroup(owner, workspace.id(), "Before");
        UUID workspaceMemberId = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace.id(), member.getId())
                .orElseThrow().getId();
        mockMvc.perform(put(groupMember(workspace.id(), groupId, workspaceMemberId)).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());

        mockMvc.perform(put(group(workspace.id(), groupId)).cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"After\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("After"));
        mockMvc.perform(get(groupMembers(workspace.id(), groupId)).cookie(authCookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(delete(group(workspace.id(), groupId)).cookie(authCookie(owner)))
                .andExpect(status().isConflict());
        mockMvc.perform(get(groupMembers(workspace.id(), groupId)).cookie(authCookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(delete(groupMember(workspace.id(), groupId, workspaceMemberId)).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete(group(workspace.id(), groupId)).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get(groups(workspace.id())).cookie(authCookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/workspaces/{workspaceId}/activity", workspace.id()).cookie(authCookie(owner))
                        .param("action", "group_deleted").param("resourceType", "group"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test
    void invalidWorkspaceGroupAndWorkspaceMemberReturnNotFound() throws Exception {
        User owner = createUser();
        WorkspaceResponse workspace = configureWorkspace(owner);
        UUID groupId = createGroup(owner, workspace.id(), "Valid");

        mockMvc.perform(get(groups(UUID.randomUUID())).cookie(authCookie(owner))).andExpect(status().isNotFound());
        mockMvc.perform(get(groupMembers(workspace.id(), UUID.randomUUID())).cookie(authCookie(owner)))
                .andExpect(status().isNotFound());
        mockMvc.perform(put(groupMember(workspace.id(), groupId, UUID.randomUUID())).cookie(authCookie(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void nonOwnerWithActivityReadCannotSeeGroupAdministrationEvents() throws Exception {
        User owner = createUser("Owner");
        User administrator = createUser("Administrator");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(administrator, workspace.id());
        grant(administrator, workspace.id(), "group", "manage");
        grant(administrator, workspace.id(), "activity", "read");
        createGroup(administrator, workspace.id(), "Private administration event");

        mockMvc.perform(get("/workspaces/{workspaceId}/activity", workspace.id()).cookie(authCookie(administrator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        mockMvc.perform(get("/workspaces/{workspaceId}/activity", workspace.id()).cookie(authCookie(owner))
                        .param("action", "group_created").param("resourceType", "group"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
    }

    private UUID createGroup(User owner, UUID workspaceId, String name) throws Exception {
        MvcResult result = mockMvc.perform(post(groups(workspaceId)).cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("name", name))))
                .andExpect(status().isCreated()).andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }

    private void grant(User user, UUID workspaceId, String resource, String action) {
        WorkspaceRole role = workspaceRoleRepository.findByWorkspaceIdAndName(workspaceId, "Member").orElseThrow();
        RolePermission permission = new RolePermission();
        permission.setRole(role);
        permission.setResource(resource);
        permission.setAction(action);
        rolePermissionRepository.saveAndFlush(permission);
        var membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, user.getId()).orElseThrow();
        membership.setRole(role);
        workspaceMemberRepository.saveAndFlush(membership);
    }

    private String groups(UUID workspaceId) {
        return "/workspaces/%s/groups".formatted(workspaceId);
    }

    private String group(UUID workspaceId, UUID groupId) {
        return groups(workspaceId) + "/" + groupId;
    }

    private String groupMembers(UUID workspaceId, UUID groupId) {
        return group(workspaceId, groupId) + "/members";
    }

    private String groupMember(UUID workspaceId, UUID groupId, UUID workspaceMemberId) {
        return groupMembers(workspaceId, groupId) + "/" + workspaceMemberId;
    }
}
