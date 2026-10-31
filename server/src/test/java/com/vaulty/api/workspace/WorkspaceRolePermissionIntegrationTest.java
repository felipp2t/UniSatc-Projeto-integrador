package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.entity.RefreshToken;
import com.vaulty.api.entity.RolePermission;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.repository.RefreshTokenRepository;
import com.vaulty.api.service.JwtService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

class WorkspaceRolePermissionIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    void ownerCanReadCatalogAndRolePermissionsAndReplaceThemWithEmptyOrCatalogEntries() throws Exception {
        User owner = createUser("Dona");
        var workspace = configureWorkspace(owner);
        WorkspaceRole role = createRole(workspace.id(), "Auditor");

        mockMvc.perform(get("/workspaces/{workspaceId}/roles/permissions/catalog", workspace.id())
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.resource == 'collection' && @.action == 'read')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.resource == 'group' && @.action == 'manage')]").isNotEmpty());
        mockMvc.perform(get("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(get("/workspaces/{workspaceId}/roles/{roleId}/permissions", UUID.randomUUID(), role.getId())
                        .cookie(authCookie(owner)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), UUID.randomUUID())
                        .cookie(authCookie(owner)))
                .andExpect(status().isNotFound());

        mockMvc.perform(put("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"permissions":[{"resource":"collection","action":"read"},
                                                 {"resource":"group","action":"manage"}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions.length()").value(2));

        mockMvc.perform(put("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions").isEmpty());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM role_permission WHERE role_id = ?", Integer.class,
                role.getId())).isZero();
    }

    @Test
    void nonOwnerAndOutsiderCannotReadCatalogOrReadAndReplaceRolePermissions() throws Exception {
        User owner = createUser("Dona");
        User member = createUser("Membro");
        User outsider = createUser("Externo");
        var workspace = configureWorkspace(owner);
        addMember(member, workspace.id());
        WorkspaceRole role = createRole(workspace.id(), "Auditor");

        for (User nonOwner : new User[] {member}) {
            mockMvc.perform(get("/workspaces/{workspaceId}/roles/permissions/catalog", workspace.id())
                            .cookie(authCookie(nonOwner))).andExpect(status().isForbidden());
            mockMvc.perform(get("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                            .cookie(authCookie(nonOwner))).andExpect(status().isForbidden());
            mockMvc.perform(put("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                            .cookie(authCookie(nonOwner)).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"permissions\":[{\"resource\":\"collection\",\"action\":\"read\"}]}"))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(get("/workspaces/{workspaceId}/roles/permissions/catalog", workspace.id())
                        .cookie(authCookieWithoutMembership(outsider))).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                        .cookie(authCookieWithoutMembership(outsider))).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                        .cookie(authCookieWithoutMembership(outsider)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[]}"))
                .andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM role_permission WHERE role_id = ?", Integer.class,
                role.getId())).isZero();
    }

    @Test
    void rejectsUnknownResourceOrActionAndDuplicatePermissions() throws Exception {
        User owner = createUser("Dona");
        var workspace = configureWorkspace(owner);
        WorkspaceRole role = createRole(workspace.id(), "Auditor");

        assertRejected(owner, workspace.id(), role.getId(), "[{\"resource\":\"invented\",\"action\":\"read\"}]");
        assertRejected(owner, workspace.id(), role.getId(), "[{\"resource\":\"collection\",\"action\":\"invented\"}]");
        assertRejected(owner, workspace.id(), role.getId(), "[{\"resource\":\"collection\",\"action\":\"read\"},"
                + "{\"resource\":\"collection\",\"action\":\"read\"}]");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM role_permission WHERE role_id = ?", Integer.class,
                role.getId())).isZero();
    }

    @Test
    void cannotChangePermissionsOfInitialOwnerOrMemberRoles() throws Exception {
        User owner = createUser("Dona");
        var workspace = configureWorkspace(owner);
        for (String name : new String[] {WorkspaceRole.OWNER_ROLE_NAME, WorkspaceRole.MEMBER_ROLE_NAME}) {
            WorkspaceRole initialRole = workspaceRoleRepository
                    .findByWorkspaceIdAndName(workspace.id(), name).orElseThrow();
            mockMvc.perform(put("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), initialRole.getId())
                            .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"permissions\":[]}"))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void permissionChangeIsLoggedWithActorAndBeforeAfterSnapshots() throws Exception {
        User owner = createUser("Dona");
        var workspace = configureWorkspace(owner);
        WorkspaceRole role = createRole(workspace.id(), "Auditor");
        insertPermission(role, "collection", "read");

        mockMvc.perform(put("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[{\"resource\":\"item\",\"action\":\"read\"}]}"))
                .andExpect(status().isOk());

        var entry = jdbc.queryForMap("""
                SELECT workspace_id, actor_id, actor_context, action, resource_type, resource_id, snapshot
                FROM activity_log WHERE resource_id = ? AND action = 'role_permissions_changed'
                """, role.getId());
        assertThat(entry.get("workspace_id").toString()).isEqualTo(workspace.id().toString());
        assertThat(entry.get("actor_id").toString()).isEqualTo(owner.getId().toString());
        assertThat(entry).containsEntry("actor_context", "USER").containsEntry("resource_type", "role")
                .containsEntry("resource_id", role.getId());
        assertThat(entry.get("snapshot").toString()).contains("collection", "item", "previous", "current");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentPermissionReplacementsSerializeAndRecordChainedSnapshots() throws Exception {
        User owner = createUser("Dona");
        var workspace = configureWorkspace(owner);
        WorkspaceRole role = createRole(workspace.id(), "ConcurrentEditor");
        var ownerCookie = authCookie(owner);
        String firstRequest = "{\"permissions\":[{\"resource\":\"collection\",\"action\":\"read\"},"
                + "{\"resource\":\"item\",\"action\":\"read\"}]}";
        String secondRequest = "{\"permissions\":[{\"resource\":\"collection\",\"action\":\"create\"},"
                + "{\"resource\":\"secret\",\"action\":\"read\"}]}";
        CountDownLatch lockHeld = new CountDownLatch(1);
        CountDownLatch releaseLock = new CountDownLatch(1);
        ExecutorService requests = Executors.newFixedThreadPool(3);
        TransactionTemplate blockerTransaction = new TransactionTemplate(transactionManager);

        try {
            Future<?> blocker = requests.submit(() -> blockerTransaction.execute(status -> {
                jdbc.queryForObject("SELECT id FROM workspace_role WHERE id = ? FOR UPDATE", UUID.class, role.getId());
                lockHeld.countDown();
                try {
                    if (!releaseLock.await(10, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Timed out while holding the role row lock");
                    }
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Interrupted while holding the role row lock", exception);
                }
                return null;
            }));
            assertThat(lockHeld.await(5, TimeUnit.SECONDS)).isTrue();

            Future<Integer> first = requests.submit(() -> replaceConcurrently(
                    workspace.id(), role.getId(), ownerCookie, firstRequest));
            awaitBlockedRequests(1);
            Future<Integer> second = requests.submit(() -> replaceConcurrently(
                    workspace.id(), role.getId(), ownerCookie, secondRequest));
            awaitBlockedRequests(2);

            releaseLock.countDown();
            blocker.get(5, TimeUnit.SECONDS);
            assertThat(first.get(15, TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(second.get(15, TimeUnit.SECONDS)).isEqualTo(200);
        } finally {
            releaseLock.countDown();
            requests.shutdownNow();
        }

        Set<String> firstSet = Set.of("collection:read", "item:read");
        Set<String> secondSet = Set.of("collection:create", "secret:read");
        List<String> storedPermissions = jdbc.queryForList("""
                SELECT resource || ':' || action FROM role_permission WHERE role_id = ? ORDER BY resource, action
                """, String.class, role.getId());
        assertThat(Set.copyOf(storedPermissions)).isIn(firstSet, secondSet);

        List<JsonNode> snapshots = jdbc.queryForList("""
                SELECT snapshot::text FROM activity_log
                WHERE resource_id = ? AND action = 'role_permissions_changed'
                """, String.class, role.getId()).stream().map(this::parseJson).toList();
        assertThat(snapshots).hasSize(2);
        JsonNode firstChange = snapshots.stream().filter(snapshot -> snapshot.get("previous").isEmpty())
                .findFirst().orElseThrow();
        Set<String> firstCurrent = permissionPairs(firstChange.get("current"));
        assertThat(firstCurrent).isIn(firstSet, secondSet);

        JsonNode followingChange = snapshots.stream()
                .filter(snapshot -> permissionPairs(snapshot.get("previous")).equals(firstCurrent))
                .findFirst().orElseThrow();
        Set<String> finalPermissions = permissionPairs(followingChange.get("current"));
        assertThat(finalPermissions).isIn(firstSet, secondSet).isNotEqualTo(firstCurrent);
        assertThat(Set.copyOf(storedPermissions)).isEqualTo(finalPermissions);
    }

    @Test
    void existingAccessTokensUsePermissionChangesOnNextRequest() throws Exception {
        User owner = createUser("Dona");
        User member = createUser("Membro");
        var workspace = configureWorkspace(owner);
        WorkspaceRole role = createRole(workspace.id(), "Editor");
        addMember(member, workspace.id());
        var membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace.id(), member.getId())
                .orElseThrow();
        membership.setRole(role);
        workspaceMemberRepository.saveAndFlush(membership);
        String accessToken = jwtService.generateAccessToken(member.getId(), membership.getId(), role.getName());
        String refreshValue = "refresh-" + UUID.randomUUID();
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(refreshValue);
        refreshToken.setUser(member);
        refreshToken.setWorkspaceMember(membership);
        refreshToken.setExpiresAt(OffsetDateTime.now().plusHours(1));
        refreshTokenRepository.saveAndFlush(refreshToken);

        mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspace.id())
                        .cookie(new jakarta.servlet.http.Cookie("accessToken", accessToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Before grant\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspace.id(), role.getId())
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":[{\"resource\":\"collection\",\"action\":\"create\"}]}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspace.id())
                        .cookie(new jakarta.servlet.http.Cookie("accessToken", accessToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"After grant\"}"))
                .andExpect(status().isCreated());
        var refreshed = mockMvc.perform(post("/auth/refresh")
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", refreshValue)))
                .andExpect(status().isOk()).andReturn();
        String renewedAccessToken = refreshed.getResponse().getCookie("accessToken").getValue();
        var renewedClaims = jwtService.validateAccessToken(renewedAccessToken).orElseThrow();
        assertThat(renewedClaims.membershipId()).isEqualTo(membership.getId());
        assertThat(renewedClaims.role()).isEqualTo(role.getName());
        mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspace.id())
                        .cookie(new jakarta.servlet.http.Cookie("accessToken", renewedAccessToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"After refresh\"}"))
                .andExpect(status().isCreated());
    }

    private void assertRejected(User owner, UUID workspaceId, UUID roleId, String permissions) throws Exception {
        mockMvc.perform(put("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspaceId, roleId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissions\":" + permissions + "}"))
                .andExpect(status().isBadRequest());
    }

    private WorkspaceRole createRole(UUID workspaceId, String name) {
        WorkspaceRole role = new WorkspaceRole();
        role.setWorkspace(workspaceRepository.findById(workspaceId).orElseThrow());
        role.setName(name);
        return workspaceRoleRepository.saveAndFlush(role);
    }

    private void insertPermission(WorkspaceRole role, String resource, String action) {
        RolePermission permission = new RolePermission();
        permission.setRole(role);
        permission.setResource(resource);
        permission.setAction(action);
        rolePermissionRepository.saveAndFlush(permission);
    }

    private int replaceConcurrently(UUID workspaceId, UUID roleId,
                                    jakarta.servlet.http.Cookie ownerCookie, String requestBody) throws Exception {
        return mockMvc.perform(put("/workspaces/{workspaceId}/roles/{roleId}/permissions", workspaceId, roleId)
                        .cookie(ownerCookie).contentType(MediaType.APPLICATION_JSON).content(requestBody))
                .andReturn().getResponse().getStatus();
    }

    private void awaitBlockedRequests(int expectedCount) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        int blockedRequests = 0;
        do {
            blockedRequests = jdbc.queryForObject("""
                    SELECT count(*) FROM pg_stat_activity
                    WHERE wait_event_type = 'Lock' AND query LIKE '%workspace_role%'
                    """, Integer.class);
            if (blockedRequests >= expectedCount) {
                return;
            }
            Thread.sleep(10);
        } while (System.nanoTime() < deadline);
        assertThat(blockedRequests).as("requests waiting for the held role lock").isEqualTo(expectedCount);
    }

    private JsonNode parseJson(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("Activity snapshot was not valid JSON", exception);
        }
    }

    private Set<String> permissionPairs(JsonNode permissions) {
        return java.util.stream.StreamSupport.stream(permissions.spliterator(), false)
                .map(permission -> permission.get("resource").asText() + ":" + permission.get("action").asText())
                .collect(java.util.stream.Collectors.toSet());
    }
}
