package com.vaulty.api.workspace;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.RolePermission;
import com.vaulty.api.entity.WorkspaceRole;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class WorkspaceMemberIntegrationTest extends WorkspaceIntegrationSupport {

    @Test
    void ownerGetsEveryActionForEveryResource() throws Exception {
        User owner = createUser("Proprietário");
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id()).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isOwner").value(true))
                .andExpect(jsonPath("$.roleName").value("Owner"))
                .andExpect(jsonPath("$.permissions.length()").value(31))
                .andExpect(jsonPath("$.permissions[?(@.resource == 'group' && @.action == 'manage')]").isNotEmpty());
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
                .andExpect(jsonPath("$.permissions[?(@.resource == 'group')]").isEmpty())
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
        RolePermission groupPermission = new RolePermission();
        groupPermission.setRole(role);
        groupPermission.setResource("group");
        groupPermission.setAction("all");
        rolePermissionRepository.saveAndFlush(groupPermission);
        addMember(member, workspace.id());
        var membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace.id(), member.getId())
                .orElseThrow();
        membership.setRole(role);
        workspaceMemberRepository.saveAndFlush(membership);

        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id()).cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions.length()").value(6))
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'read')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'create')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'update')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'delete')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'invite')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'group' && @.action == 'manage')]").isNotEmpty());
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
