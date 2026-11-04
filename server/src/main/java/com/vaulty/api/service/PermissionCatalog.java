package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.WorkspacePermission;
import java.util.List;
import java.util.stream.Stream;

public final class PermissionCatalog {

    private static final List<String> RESOURCES =
            List.of("workspace", "collection", "item", "secret", "member", "role", "activity");
    private static final List<String> ACTIONS = List.of("read", "create", "update", "delete", "invite", "all");
    private static final List<WorkspacePermission> PERMISSIONS = Stream.concat(
                    RESOURCES.stream().flatMap(resource -> ACTIONS.stream()
                            .map(action -> new WorkspacePermission(resource, action))),
                    Stream.of(new WorkspacePermission("group", "manage"),
                            new WorkspacePermission("sharing", "manage")))
            .toList();

    private PermissionCatalog() {}

    public static List<WorkspacePermission> permissions() {
        return PERMISSIONS;
    }

    public static boolean contains(WorkspacePermission permission) {
        return PERMISSIONS.contains(permission);
    }

    public static List<WorkspacePermission> effectiveOwnerPermissions() {
        return PERMISSIONS.stream().filter(permission -> !"all".equals(permission.action())
                && !"secret".equals(permission.resource())).toList();
    }

    public static List<String> actions(String resource) {
        return PERMISSIONS.stream()
                .filter(permission -> resource.equals(permission.resource()) && !"all".equals(permission.action()))
                .map(WorkspacePermission::action)
                .toList();
    }
}
