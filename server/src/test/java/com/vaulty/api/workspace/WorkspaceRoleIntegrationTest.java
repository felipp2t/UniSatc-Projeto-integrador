package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.entity.User;
import com.vaulty.api.enums.GlobalRole;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class WorkspaceRoleIntegrationTest extends WorkspaceIntegrationSupport {

    @Test
    void ownerReceivesTheFixedRoleDefinitions() throws Exception {
        User owner = createUser("Owner");
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(get(roles(workspace.id())).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'OWNER' && @.scope == 'GLOBAL')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.code == 'ADMIN' && @.scope == 'GLOBAL')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.code == 'MAINTAINER' && @.scope == 'GLOBAL')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.code == 'LEADER' && @.scope == 'COLLECTION')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.code == 'MEMBER' && @.scope == 'COLLECTION')]").isNotEmpty());
    }

    @Test
    void customRoleCreationIsRejectedBecauseTheCatalogIsFixed() throws Exception {
        User owner = createUser("Owner");
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(post(roles(workspace.id()))
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Financeiro\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void ownerCanAssignAdminMaintainerAndClearGlobalRole() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());
        UUID membershipId = memberId(member, workspace.id());

        mockMvc.perform(put("/workspaces/{workspaceId}/members/{memberId}/role", workspace.id(), membershipId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"globalRole\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.globalRole").value("ADMIN"));
        mockMvc.perform(put("/workspaces/{workspaceId}/members/{memberId}/role", workspace.id(), membershipId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"globalRole\":\"MAINTAINER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.globalRole").value("MAINTAINER"));
        mockMvc.perform(put("/workspaces/{workspaceId}/members/{memberId}/role", workspace.id(), membershipId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"globalRole\":null}"))
                .andExpect(status().isOk());
        assertThat(workspaceMemberRepository.findById(membershipId).orElseThrow().getGlobalRole()).isNull();
    }

    @Test
    void ownershipTransferMakesTheRecipientOwnerAndPromotesPreviousOwnerToAdmin() throws Exception {
        User owner = createUser("Owner");
        User nextOwner = createUser("Next Owner");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(nextOwner, workspace.id());
        UUID nextOwnerMembershipId = memberId(nextOwner, workspace.id());

        mockMvc.perform(put("/workspaces/{workspaceId}/members/transfer-owner", workspace.id())
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"memberId\":\"%s\"}".formatted(nextOwnerMembershipId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(nextOwner.getId().toString()));

        assertThat(workspaceRepository.findById(workspace.id()).orElseThrow().getOwner().getId())
                .isEqualTo(nextOwner.getId());
        assertThat(workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace.id(), owner.getId())
                        .orElseThrow().getGlobalRole())
                .isEqualTo(GlobalRole.ADMIN);
    }

    @Test
    void membersCannotReadRoleDefinitions() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());

        mockMvc.perform(get(roles(workspace.id())).cookie(authCookie(member)))
                .andExpect(status().isForbidden());
    }

    private UUID memberId(User user, UUID workspaceId) {
        return workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, user.getId())
                .orElseThrow().getId();
    }

    private String roles(UUID workspaceId) {
        return "/workspaces/%s/roles".formatted(workspaceId);
    }
}
