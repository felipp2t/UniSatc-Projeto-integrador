package com.vaulty.api.workspace;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.entity.User;
import com.vaulty.api.entity.WorkspaceRole;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class WorkspaceRolePermissionIntegrationTest extends WorkspaceIntegrationSupport {

    @Test
    void rolePermissionCatalogAndReadsRejectEditableRoleConfiguration() throws Exception {
        User owner = createUser("Owner");
        var workspace = configureWorkspace(owner);
        WorkspaceRole role = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspace.id(), WorkspaceRole.OWNER_ROLE_NAME).orElseThrow();

        mockMvc.perform(get("/workspaces/{workspaceId}/roles/permissions/catalog", workspace.id())
                        .cookie(authCookie(owner)))
                .andExpect(status().isConflict());
        mockMvc.perform(get("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                        .cookie(authCookie(owner)))
                .andExpect(status().isConflict());
        mockMvc.perform(get("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), UUID.randomUUID())
                        .cookie(authCookie(owner)))
                .andExpect(status().isConflict());
    }

    @Test
    void rolePermissionReplacementIsRejectedAndDoesNotPersistLegacyGrants() throws Exception {
        User owner = createUser("Owner");
        var workspace = configureWorkspace(owner);
        WorkspaceRole role = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspace.id(), WorkspaceRole.OWNER_ROLE_NAME).orElseThrow();

        mockMvc.perform(put("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[{\"resource\":\"collection\",\"action\":\"read\"}]}"))
                .andExpect(status().isConflict());

        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM role_permission WHERE role_id = ?", Integer.class, role.getId())).isZero();
    }

    @Test
    void nonOwnerCannotUseLegacyRolePermissionManagement() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        var workspace = configureWorkspace(owner);
        addMember(member, workspace.id());
        WorkspaceRole role = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspace.id(), WorkspaceRole.OWNER_ROLE_NAME).orElseThrow();

        mockMvc.perform(get("/workspaces/{workspaceId}/roles/permissions/catalog", workspace.id())
                        .cookie(authCookie(member)))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                        .cookie(authCookie(member)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[]}"))
                .andExpect(status().isForbidden());
    }
}
