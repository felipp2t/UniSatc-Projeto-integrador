package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.storage.ObjectStorage;
import com.vaulty.api.storage.StorageOperationException;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

class CriticalBusinessRulesIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private ObjectMapper mapper;
    @MockBean private ObjectStorage storage;
    private final Set<UUID> committedUsers = new HashSet<>();
    private final Set<UUID> committedItems = new HashSet<>();
    private final Set<UUID> committedRoles = new HashSet<>();
    private UUID committedWorkspace;
    private UUID originalWorkspaceOwner;
    private UUID originalOwnerRole;
    private String originalWorkspaceName;
    private String originalWorkspaceDescription;

    @AfterEach
    void cleanupCommittedFixtures() {
        if (committedUsers.isEmpty() && committedItems.isEmpty() && committedRoles.isEmpty()) return;
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            if (committedWorkspace != null) {
                jdbc.update("UPDATE workspace SET owner_id = ?, name = ?, description = ? WHERE id = ?",
                        originalWorkspaceOwner, originalWorkspaceName, originalWorkspaceDescription, committedWorkspace);
            }
            for (UUID userId : committedUsers) {
                jdbc.update("DELETE FROM activity_log WHERE actor_id = ? OR resource_id = ?", userId, userId);
                jdbc.update("DELETE FROM workspace_member WHERE user_id = ?", userId);
                jdbc.update("DELETE FROM \"user\" WHERE id = ?", userId);
            }
            for (UUID itemId : committedItems) {
                jdbc.update("DELETE FROM activity_log WHERE resource_id = ?", itemId);
                jdbc.update("DELETE FROM item WHERE id = ?", itemId);
            }
            for (UUID roleId : committedRoles) {
                jdbc.update("DELETE FROM activity_log WHERE resource_id = ?", roleId);
                jdbc.update("DELETE FROM workspace_role WHERE id = ?", roleId);
            }
            if (committedWorkspace != null) {
                jdbc.update("""
                        INSERT INTO workspace_member (id, user_id, workspace_id, role_id)
                        SELECT gen_random_uuid(), ?, ?, role.id
                        FROM workspace_role role
                        WHERE role.workspace_id = ? AND role.id = ?
                        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id
                        """, originalWorkspaceOwner, committedWorkspace, committedWorkspace, originalOwnerRole);
            }
        });
        committedUsers.clear();
        committedItems.clear();
        committedRoles.clear();
        committedWorkspace = null;
    }

    @Test
    void databaseEnforcesInlineContentShapeAndAcceptsValidTypeBranches() {
        UUID workspace = jdbc.queryForObject("SELECT id FROM workspace", UUID.class);
        UUID itemId = UUID.randomUUID();

        jdbc.update("""
                INSERT INTO item (id, workspace_id, type, title, text_content)
                VALUES (?, ?, 'text', 'valid text', 'body')
                """, itemId, workspace);
        jdbc.update("""
                INSERT INTO item (id, workspace_id, type, title, link_url)
                VALUES (?, ?, 'link', 'valid link', 'HTTPS://example.test')
                """, UUID.randomUUID(), workspace);
        jdbc.update("""
                INSERT INTO item (id, workspace_id, type, title)
                VALUES (?, ?, 'file', 'valid file')
                """, UUID.randomUUID(), workspace);
        jdbc.update("""
                INSERT INTO item (id, workspace_id, type, title)
                VALUES (?, ?, 'image', 'valid image')
                """, UUID.randomUUID(), workspace);
        jdbc.update("INSERT INTO item (id, workspace_id, type, title) VALUES (?, ?, 'video', 'valid video')",
                UUID.randomUUID(), workspace);
        jdbc.update("INSERT INTO item (id, workspace_id, type, title) VALUES (?, ?, 'secret', 'valid secret')",
                UUID.randomUUID(), workspace);

        assertThat(jdbc.queryForObject("SELECT count(*) FROM item WHERE workspace_id = ?", Integer.class, workspace))
                .isEqualTo(6);
    }

    @ParameterizedTest
    @MethodSource("invalidInlineContent")
    void databaseRejectsInlineContentThatDoesNotMatchItemType(String type, String text, String url) {
        UUID workspace = jdbc.queryForObject("SELECT id FROM workspace", UUID.class);
        assertConstraintViolation("ck_item_inline_content", () -> jdbc.update("""
                INSERT INTO item (id, workspace_id, type, title, text_content, link_url)
                VALUES (?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), workspace, type, "invalid " + UUID.randomUUID(), text, url));
    }

    static Stream<org.junit.jupiter.params.provider.Arguments> invalidInlineContent() {
        return Stream.of(
                org.junit.jupiter.params.provider.Arguments.of("text", "body", "https://example.test"),
                org.junit.jupiter.params.provider.Arguments.of("link", "body", "https://example.test"),
                org.junit.jupiter.params.provider.Arguments.of("secret", "body", null),
                org.junit.jupiter.params.provider.Arguments.of("link", null, "ftp://example.test"));
    }

    @ParameterizedTest
    @MethodSource("invalidMediaRows")
    void itemMediaConstraintsRequireAFileAndValidFormatAndDimensions(String format, int width, int height,
                                                                     boolean missingFile, String constraint) {
        UUID workspace = jdbc.queryForObject("SELECT id FROM workspace", UUID.class);
        UUID itemId = UUID.randomUUID();
        if (!missingFile) {
            jdbc.update("INSERT INTO item (id, workspace_id, type, title) VALUES (?, ?, 'image', ?)",
                    itemId, workspace, "media " + itemId);
            jdbc.update("""
                    INSERT INTO item_file (item_id, storage_key, original_name, mime_type, size_bytes)
                    VALUES (?, ?, 'image.png', 'image/png', 10)
                    """, itemId, "key-" + itemId);
        }

        assertConstraintViolation(constraint, () -> jdbc.update("""
                INSERT INTO item_media (item_id, format, width, height) VALUES (?, ?, ?, ?)
                """, itemId, format, width, height));
    }

    static Stream<org.junit.jupiter.params.provider.Arguments> invalidMediaRows() {
        return Stream.of(
                org.junit.jupiter.params.provider.Arguments.of("gif", 10, 10, false, "item_media_format_check"),
                org.junit.jupiter.params.provider.Arguments.of("png", 0, 10, false, "item_media_width_check"),
                org.junit.jupiter.params.provider.Arguments.of("jpeg", 10, 0, false, "item_media_height_check"),
                org.junit.jupiter.params.provider.Arguments.of("png", 10, 10, true, "item_media_item_id_fkey"));
    }

    @Test
    void databaseEnforcesMediaRulesForAValidImageFile() {
        UUID workspace = jdbc.queryForObject("SELECT id FROM workspace", UUID.class);
        UUID itemId = UUID.randomUUID();
        jdbc.update("INSERT INTO item (id, workspace_id, type, title) VALUES (?, ?, 'image', ?)",
                itemId, workspace, "valid media " + itemId);
        jdbc.update("""
                INSERT INTO item_file (item_id, storage_key, original_name, mime_type, size_bytes)
                VALUES (?, ?, 'image.png', 'image/png', 10)
                """, itemId, "key-" + itemId);

        jdbc.update("INSERT INTO item_media (item_id, format, width, height) VALUES (?, 'png', 1, 1)", itemId);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM item_media WHERE item_id = ?", Integer.class, itemId))
                .isOne();
    }

    @Test
    void databaseEnforcesWorkspaceMemberUniqueness() {
        User owner = createUser("Constraint owner");
        UUID workspace = configureWorkspace(owner).id();
        UUID ownerRole = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace, owner.getId())
                .orElseThrow().getRole().getId();

        assertConstraintViolation("uq_workspace_member_workspace_user", () -> jdbc.update("""
                INSERT INTO workspace_member (id, user_id, workspace_id, role_id) VALUES (?, ?, ?, ?)
                """, UUID.randomUUID(), owner.getId(), workspace, ownerRole));
    }

    @Test
    void roleCatalogAddsOnlyTheSharingManagePermission() throws Exception {
        User owner = createUser("Catalog owner");
        UUID workspace = configureWorkspace(owner).id();
        mockMvc.perform(get("/workspaces/{workspaceId}/roles/permissions/catalog", workspace)
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.resource == 'sharing')].action")
                        .value(org.hamcrest.Matchers.contains("manage")));
    }

    @Test
    void databaseRestrictsDeletingRoleInUse() {
        User owner = createUser("Role constraint owner");
        UUID workspace = configureWorkspace(owner).id();
        UUID ownerRole = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace, owner.getId())
                .orElseThrow().getRole().getId();
        assertConstraintViolation("workspace_member_role_id_fkey", () -> jdbc.update(
                "DELETE FROM workspace_role WHERE id = ?", ownerRole));
    }

    @Test
    void databaseRestrictsDeletingReferencedFolder() {
        User owner = createUser("Folder constraint owner");
        UUID workspace = configureWorkspace(owner).id();
        UUID folder = UUID.randomUUID();
        UUID item = UUID.randomUUID();
        jdbc.update("INSERT INTO collection (id, workspace_id, name) VALUES (?, ?, 'Referenced folder')",
                folder, workspace);
        jdbc.update("""
                INSERT INTO item (id, workspace_id, collection_id, type, title, text_content)
                VALUES (?, ?, ?, 'text', 'Folder item', 'body')
                """, item, workspace, folder);
        assertConstraintViolation("fk_item_collection_workspace", () -> jdbc.update(
                "DELETE FROM collection WHERE id = ?", folder));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void memberRemovalCascadesIndividualGrantsAndRejectsItsRefreshToken() throws Exception {
        User owner = createUser("Owner");
        committedUsers.add(owner.getId());
        User member = createUser("Member");
        committedUsers.add(member.getId());
        UUID workspace = configureWorkspaceWithFixtureCleanup(owner);
        addMember(member, workspace);
        UUID membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace, member.getId())
                .orElseThrow().getId();
        String itemResponse = mockMvc.perform(post("/workspaces/{workspaceId}/items", workspace)
                        .cookie(authCookie(owner)).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"text\",\"title\":\"Shared item\",\"textContent\":\"body\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID item = UUID.fromString(com.fasterxml.jackson.databind.json.JsonMapper.builder().build()
                .readTree(itemResponse).get("id").asText());
        committedItems.add(item);
        MvcResult login = mockMvc.perform(post("/auth/login")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + member.getEmail() + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk()).andReturn();
        var refresh = login.getResponse().getCookie("refreshToken");

        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/items/{itemId}/members/{memberId}",
                        workspace, item, membership).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM item_member_grant WHERE item_id = ?", Integer.class, item))
                .isOne();

        mockMvc.perform(delete("/workspaces/{workspaceId}/members/{membershipId}", workspace, membership)
                        .cookie(authCookie(owner)).param("confirmMemberId", membership.toString()))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM item_member_grant WHERE item_id = ?", Integer.class, item))
                .isZero();
        mockMvc.perform(post("/auth/refresh").cookie(refresh)).andExpect(status().isUnauthorized());
    }

    @Test
    void failedAttachmentReplacementPreservesItsDescription() throws Exception {
        User owner = createUser("Attachment owner");
        UUID workspace = configureWorkspace(owner).id();
        byte[] previousContent = "previous attachment".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String response = mockMvc.perform(multipart("/workspaces/{workspaceId}/items/attachments", workspace)
                        .file(new MockMultipartFile("file", "original.txt", "text/plain", previousContent))
                        .param("title", "Described attachment").param("description", "Uso interno")
                        .cookie(authCookie(owner)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID item = UUID.fromString(mapper.readTree(response).get("itemId").asText());
        String previousKey = jdbc.queryForObject("SELECT storage_key FROM item_file WHERE item_id = ?",
                String.class, item);
        org.mockito.Mockito.when(storage.get(anyString())).thenReturn(previousContent);
        doThrow(new StorageOperationException("storage unavailable", new IllegalStateException("cause")))
                .when(storage).put(argThat(key -> !key.equals(previousKey)), any(byte[].class), anyString());

        mockMvc.perform(multipart("/workspaces/{workspaceId}/items/{itemId}/attachment", workspace, item)
                        .file(new MockMultipartFile("file", "replacement.txt", "text/plain", "new bytes".getBytes()))
                        .with(request -> {
                            request.setMethod("PUT");
                            return request;
                        }).cookie(authCookie(owner)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value(
                        "Não foi possível substituir o anexo; o arquivo anterior continua disponível."));

        assertThat(jdbc.queryForObject("SELECT description FROM item WHERE id = ?", String.class, item))
                .isEqualTo("Uso interno");
        assertThat(jdbc.queryForObject("SELECT storage_key FROM item_file WHERE item_id = ?", String.class, item))
                .isEqualTo(previousKey);
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/attachment", workspace, item)
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
                        .bytes(previousContent));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void sharingRoleMutationWaitsForRolePermissionUpdateLock() throws Exception {
        User owner = createUser("Role owner");
        committedUsers.add(owner.getId());
        UUID workspace = configureWorkspaceWithFixtureCleanup(owner);
        WorkspaceRole role = new WorkspaceRole();
        role.setWorkspace(workspaceRepository.findById(workspace).orElseThrow());
        role.setName("Concurrent sharing");
        role = workspaceRoleRepository.saveAndFlush(role);
        UUID roleId = role.getId();
        committedRoles.add(roleId);
        CountDownLatch lockHeld = new CountDownLatch(1);
        CountDownLatch releaseLock = new CountDownLatch(1);
        ExecutorService requests = Executors.newFixedThreadPool(2);
        TransactionTemplate blockerTransaction = new TransactionTemplate(transactionManager);

        try {
            Future<?> blocker = requests.submit(() -> blockerTransaction.execute(status -> {
                jdbc.queryForObject("SELECT id FROM workspace_role WHERE id = ? FOR UPDATE", UUID.class, roleId);
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
            Future<Integer> mutation = requests.submit(() -> mockMvc.perform(
                            put("/workspaces/{workspaceId}/sharing/roles/{roleId}/manager", workspace, roleId)
                                    .cookie(authCookie(owner)).param("enabled", "true"))
                    .andReturn().getResponse().getStatus());
            awaitBlockedRoleRequest();
            releaseLock.countDown();
            blocker.get(5, TimeUnit.SECONDS);
            assertThat(mutation.get(15, TimeUnit.SECONDS)).isEqualTo(204);
        } finally {
            releaseLock.countDown();
            requests.shutdownNow();
        }

        assertThat(jdbc.queryForList("SELECT resource || ':' || action FROM role_permission WHERE role_id = ?",
                String.class, roleId)).contains("sharing:manage");
    }

    private void awaitBlockedRoleRequest() throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        int blocked;
        do {
            blocked = jdbc.queryForObject("""
                    SELECT count(*) FROM pg_stat_activity
                    WHERE wait_event_type = 'Lock' AND query LIKE '%workspace_role%'
                    """, Integer.class);
            if (blocked > 0) return;
            Thread.sleep(10);
        } while (System.nanoTime() < deadline);
        assertThat(blocked).as("sharing mutation waiting for the held workspace_role lock").isPositive();
    }

    private UUID configureWorkspaceWithFixtureCleanup(User owner) {
        var original = workspaceRepository.findSingleton().orElseThrow();
        committedWorkspace = original.getId();
        originalWorkspaceOwner = original.getOwner().getId();
        originalOwnerRole = workspaceMemberRepository
                .findByWorkspaceIdAndUserId(committedWorkspace, originalWorkspaceOwner).orElseThrow()
                .getRole().getId();
        originalWorkspaceName = original.getName();
        originalWorkspaceDescription = original.getDescription();
        return configureWorkspace(owner).id();
    }

    private void assertConstraintViolation(String name, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(failure -> assertThat(rootCause(failure).getMessage()).contains(name));
    }

    private Throwable rootCause(Throwable failure) {
        Throwable cause = failure;
        while (cause.getCause() != null) cause = cause.getCause();
        return cause;
    }
}
