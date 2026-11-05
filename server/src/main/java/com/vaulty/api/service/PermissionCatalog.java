package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.WorkspacePermission;
import com.vaulty.api.enums.GlobalRole;
import java.util.List;
import java.util.stream.Stream;

public final class PermissionCatalog {

    private static final List<String> CONTENT_RESOURCES = List.of("collection", "item", "secret");
    private static final List<String> CONTENT_ACTIONS = List.of("read", "create", "update", "delete");
    private static final List<WorkspacePermission> ROLE_EDITOR_CATALOG = Stream.of(
                    "workspace", "collection", "item", "secret", "member", "role", "activity", "team")
            .flatMap(resource -> Stream.of("read", "create", "update", "delete", "invite", "manage", "all")
                    .map(action -> new WorkspacePermission(resource, action)))
            .toList();
    private static final List<WorkspacePermission> CONTENT_CRUD = contentPermissions(CONTENT_ACTIONS);
    private static final List<WorkspacePermission> OWNER_PERMISSIONS = Stream.concat(
                    globalAdminPermissions().stream(),
                    Stream.of(
                            new WorkspacePermission("workspace", "read"),
                            new WorkspacePermission("workspace", "update")))
            .toList();
    private static final List<WorkspacePermission> MAINTAINER_PERMISSIONS = contentPermissions(List.of("read"));
    private static final List<WorkspacePermission> TEAM_MEMBER_PERMISSIONS = CONTENT_CRUD;
    private static final List<WorkspacePermission> TEAM_LEADER_PERMISSIONS = Stream.concat(
                    CONTENT_CRUD.stream(), Stream.of(new WorkspacePermission("team", "manage")))
            .toList();

    private PermissionCatalog() {}

    public static List<WorkspacePermission> permissions() {
        return ROLE_EDITOR_CATALOG;
    }

    public static boolean contains(WorkspacePermission permission) {
        return ROLE_EDITOR_CATALOG.contains(permission);
    }

    public static List<WorkspacePermission> effectiveOwnerPermissions() {
        return OWNER_PERMISSIONS;
    }

    public static List<WorkspacePermission> permissionsForGlobalRole(GlobalRole role) {
        if (role == null) {
            return List.of();
        }
        return role == GlobalRole.ADMIN ? globalAdminPermissions() : MAINTAINER_PERMISSIONS;
    }

    public static List<WorkspacePermission> permissionsForTeamRole(boolean leader) {
        return leader ? TEAM_LEADER_PERMISSIONS : TEAM_MEMBER_PERMISSIONS;
    }

    public static boolean allows(List<WorkspacePermission> permissions, String resource, String action) {
        return permissions.contains(new WorkspacePermission(resource, action));
    }

    public static List<String> actions(String resource) {
        return ROLE_EDITOR_CATALOG.stream()
                .filter(permission -> resource.equals(permission.resource()) && !"all".equals(permission.action()))
                .map(WorkspacePermission::action)
                .toList();
    }

    private static List<WorkspacePermission> globalAdminPermissions() {
        return Stream.concat(
                CONTENT_CRUD.stream(),
                Stream.of(
                        new WorkspacePermission("team", "create"),
                        new WorkspacePermission("team", "update"),
                        new WorkspacePermission("team", "delete"),
                        new WorkspacePermission("team", "manage"),
                        new WorkspacePermission("member", "invite"),
                        new WorkspacePermission("member", "manage"),
                        new WorkspacePermission("activity", "read")))
                .toList();
    }

    private static List<WorkspacePermission> contentPermissions(List<String> actions) {
        return CONTENT_RESOURCES.stream()
                .flatMap(resource -> actions.stream().map(action -> new WorkspacePermission(resource, action)))
                .toList();
    }
}
