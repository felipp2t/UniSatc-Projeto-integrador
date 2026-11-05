package com.vaulty.api.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.vaulty.api.dto.workspace.WorkspacePermission;
import com.vaulty.api.enums.GlobalRole;
import java.util.List;
import org.junit.jupiter.api.Test;

class PermissionCatalogTest {

    @Test
    void exposesOnlyFixedRolePermissionResources() {
        assertThat(PermissionCatalog.permissions())
                .extracting(WorkspacePermission::resource)
                .contains("team")
                .doesNotContain("group", "sharing");
    }

    @Test
    void ownerHasAdministrativeMemberAndWorkspaceManagementPermissions() {
        List<WorkspacePermission> permissions = PermissionCatalog.effectiveOwnerPermissions();

        assertThat(permissions).contains(
                new WorkspacePermission("member", "manage"),
                new WorkspacePermission("member", "invite"),
                new WorkspacePermission("team", "manage"),
                new WorkspacePermission("workspace", "update"));
    }

    @Test
    void adminCanManageTeamsButMaintainerIsReadOnly() {
        List<WorkspacePermission> admin = PermissionCatalog.permissionsForGlobalRole(GlobalRole.ADMIN);
        List<WorkspacePermission> maintainer = PermissionCatalog.permissionsForGlobalRole(GlobalRole.MAINTAINER);

        assertThat(admin).contains(new WorkspacePermission("team", "create"));
        assertThat(maintainer)
                .contains(new WorkspacePermission("item", "read"))
                .doesNotContain(new WorkspacePermission("item", "update"),
                        new WorkspacePermission("team", "manage"));
    }

    @Test
    void teamLeaderCanManageTeamWhileMemberReceivesContentCrudOnly() {
        List<WorkspacePermission> leader = PermissionCatalog.permissionsForTeamRole(true);
        List<WorkspacePermission> member = PermissionCatalog.permissionsForTeamRole(false);

        assertThat(leader).contains(new WorkspacePermission("team", "manage"));
        assertThat(member)
                .contains(new WorkspacePermission("collection", "read"),
                        new WorkspacePermission("item", "delete"))
                .doesNotContain(new WorkspacePermission("team", "manage"));
    }
}
