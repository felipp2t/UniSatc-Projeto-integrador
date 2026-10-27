package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.mapper.WorkspaceMapper;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import com.vaulty.api.service.JwtService;
import com.vaulty.api.service.WorkspaceItemService;
import com.vaulty.api.storage.ObjectStorage;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

@AutoConfigureMockMvc
class WorkspaceItemDeletionIntegrationTest extends PostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private WorkspaceRepository workspaceRepository;
    @Autowired private WorkspaceRoleRepository roleRepository;
    @Autowired private WorkspaceMemberRepository memberRepository;
    @Autowired private WorkspaceMapper workspaceMapper;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private TransactionTemplate transactions;
    @Autowired private WorkspaceItemService itemService;
    @MockBean private ObjectStorage storage;

    @AfterEach
    void restoreAdminAsWorkspaceOwner() {
        userRepository.findByEmail("admin@gmail.com").ifPresent(admin -> {
            Workspace workspace = workspaceRepository.findSingleton().orElseThrow();
            workspace.setOwner(admin);
            workspaceRepository.saveAndFlush(workspace);
            memberRepository.deleteAll();
            WorkspaceRole ownerRole = roleRepository.findByWorkspaceIdAndName(
                    workspace.getId(), WorkspaceRole.OWNER_ROLE_NAME).orElseThrow();
            memberRepository.saveAndFlush(workspaceMapper.toMember(admin, workspace, ownerRole));
        });
    }

    @Test
    void requiresConfirmationAndDeletePermissionWithoutChangingItemOrAudit() throws Exception {
        User owner = user("owner");
        UUID workspaceId = workspace(owner);
        User member = user("member");
        UUID itemId = createText(owner, workspaceId, "Still here", "secret body");
        addMember(member, workspaceId);
        jdbc.update("UPDATE item SET archived_at = now() WHERE id = ?", itemId);

        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie(owner)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie(owner)).param("confirm", "false"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie(member)).param("confirm", "true"))
                .andExpect(status().isForbidden());

        assertThat(count("item", itemId)).isOne();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM activity_log WHERE resource_id = ? AND action = 'item_deleted'",
                Integer.class, itemId)).isZero();
    }

    @Test
    void permanentlyDeletesArchivedItemCascadesSecretAndLogsOnlySnapshotThenReleasesTitle() throws Exception {
        User owner = user("owner");
        UUID workspaceId = workspace(owner);
        UUID itemId = createSecret(owner, workspaceId, "Rotating key", "highly-sensitive-value");
        jdbc.update("UPDATE item SET archived_at = now() WHERE id = ?", itemId);

        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie(owner)).param("confirm", "true"))
                .andExpect(status().isNoContent());

        assertThat(count("item", itemId)).isZero();
        assertThat(count("item_secret", itemId)).isZero();
        assertThat(jdbc.queryForMap("SELECT snapshot FROM activity_log WHERE resource_id = ? AND action = 'item_deleted'",
                        itemId).get("snapshot").toString())
                .contains("Rotating key", "secret").doesNotContain("highly-sensitive-value");
        createText(owner, workspaceId, "Rotating key", "replacement");
    }

    @Test
    void hidesSecretWithoutSecretReadAndRequiresSecretDeletePermission() throws Exception {
        User owner = user("owner");
        UUID workspaceId = workspace(owner);
        User member = user("member");
        UUID itemId = createSecret(owner, workspaceId, "Hidden secret", "private-value");
        UUID roleId = addMember(member, workspaceId);
        jdbc.update("INSERT INTO role_permission (role_id, resource, action) VALUES (?, 'item', 'delete')", roleId);
        jdbc.update("UPDATE item SET archived_at = now() WHERE id = ?", itemId);

        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie(member)).param("confirm", "true"))
                .andExpect(status().isNotFound());

        jdbc.update("INSERT INTO role_permission (role_id, resource, action) VALUES (?, 'secret', 'read')", roleId);
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie(member)).param("confirm", "true"))
                .andExpect(status().isForbidden());
        assertThat(count("item", itemId)).isOne();
        assertThat(count("item_secret", itemId)).isOne();
    }

    @Test
    void onlyArchivedItemsCanBeDeletedAndUnknownOrCrossWorkspaceIdsAreHidden() throws Exception {
        User owner = user("owner");
        UUID workspaceId = workspace(owner);
        UUID activeId = createText(owner, workspaceId, "Active", "body");
        UUID unknownWorkspaceId = UUID.randomUUID();

        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, activeId)
                        .cookie(cookie(owner)).param("confirm", "true"))
                .andExpect(status().isConflict());
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, UUID.randomUUID())
                        .cookie(cookie(owner)).param("confirm", "true"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", unknownWorkspaceId, activeId)
                        .cookie(cookie(owner)).param("confirm", "true"))
                .andExpect(status().isNotFound());
        assertThat(count("item", activeId)).isOne();
    }

    @Test
    void fileObjectIsDeletedOnlyAfterCommittedDeletionAndFailureDoesNotRestoreItem() throws Exception {
        User owner = user("owner");
        UUID workspaceId = workspace(owner);
        UUID itemId = createFile(owner, workspaceId);
        String key = jdbc.queryForObject("SELECT storage_key FROM item_file WHERE item_id = ?", String.class, itemId);
        jdbc.update("UPDATE item SET archived_at = now() WHERE id = ?", itemId);

        transactions.executeWithoutResult(tx -> {
            itemService.delete(owner.getId(), workspaceId, itemId, true);
            verify(storage, never()).delete(key);
            tx.setRollbackOnly();
        });
        assertThat(count("item", itemId)).isOne();
        verify(storage, never()).delete(key);

        doThrow(new IllegalStateException("storage unavailable")).when(storage).delete(key);
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie(owner)).param("confirm", "true"))
                .andExpect(status().isNoContent());
        assertThat(count("item", itemId)).isZero();
        verify(storage).delete(key);
    }

    @Test
    void deletingImageCascadesFileAndMediaAndDeletesStorageObjectAfterRequestCommit() throws Exception {
        User owner = user("owner");
        UUID workspaceId = workspace(owner);
        MockMultipartFile image = new MockMultipartFile("file", "pixel.png", "image/png", tinyPng());
        String response = mockMvc.perform(multipart("/workspaces/{workspaceId}/items/attachments", workspaceId)
                        .file(image).param("title", "Pixel").cookie(cookie(owner)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID itemId = UUID.fromString(new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("itemId").asText());
        String key = jdbc.queryForObject("SELECT storage_key FROM item_file WHERE item_id = ?", String.class, itemId);
        jdbc.update("UPDATE item SET archived_at = now() WHERE id = ?", itemId);

        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie(owner)).param("confirm", "true"))
                .andExpect(status().isNoContent());

        assertThat(count("item", itemId)).isZero();
        assertThat(count("item_file", itemId)).isZero();
        assertThat(count("item_media", itemId)).isZero();
        verify(storage).delete(key);
    }

    private User user(String name) {
        User user = new User();
        user.setName(name);
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("password123"));
        return userRepository.saveAndFlush(user);
    }

    private UUID workspace(User owner) {
        Workspace workspace = workspaceRepository.findSingleton().orElseThrow();
        workspace.setOwner(owner);
        workspaceRepository.saveAndFlush(workspace);
        memberRepository.deleteAll();
        jdbc.update("DELETE FROM role_permission WHERE role_id IN (SELECT id FROM workspace_role WHERE workspace_id = ?)",
                workspace.getId());
        WorkspaceRole role = roleRepository.findByWorkspaceIdAndName(workspace.getId(), WorkspaceRole.OWNER_ROLE_NAME)
                .orElseThrow();
        memberRepository.saveAndFlush(workspaceMapper.toMember(owner, workspace, role));
        WorkspaceRole memberRole = roleRepository.findByWorkspaceIdAndName(workspace.getId(), WorkspaceRole.MEMBER_ROLE_NAME)
                .orElseThrow();
        jdbc.update("INSERT INTO role_permission (role_id, resource, action) VALUES (?, 'item', 'read')", memberRole.getId());
        jdbc.update("INSERT INTO role_permission (role_id, resource, action) VALUES (?, 'collection', 'read')",
                memberRole.getId());
        return workspace.getId();
    }

    private UUID addMember(User user, UUID workspaceId) {
        Workspace workspace = workspaceRepository.findById(workspaceId).orElseThrow();
        WorkspaceRole role = roleRepository.findByWorkspaceIdAndName(workspaceId, WorkspaceRole.MEMBER_ROLE_NAME)
                .orElseThrow();
        WorkspaceMember member = workspaceMapper.toMember(user, workspace, role);
        memberRepository.saveAndFlush(member);
        return role.getId();
    }

    private Cookie cookie(User user) {
        String role = memberRepository.findByUserId(user.getId()).map(m -> m.getRole().getName()).orElse(null);
        return new Cookie("accessToken", jwtService.generateAccessToken(user.getId(), role));
    }

    private UUID createText(User owner, UUID workspaceId, String title, String text) throws Exception {
        return create(owner, workspaceId, "text", title, "\"textContent\":\"" + text + "\"");
    }

    private UUID createSecret(User owner, UUID workspaceId, String title, String value) throws Exception {
        return create(owner, workspaceId, "secret", title, "\"value\":\"" + value + "\"");
    }

    private UUID create(User owner, UUID workspaceId, String type, String title, String content) throws Exception {
        String response = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                                "/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(cookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"" + type + "\",\"title\":\"" + title + "\"," + content + "}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("id").asText());
    }

    private UUID createFile(User owner, UUID workspaceId) throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "notes.txt", "text/plain", "file contents".getBytes());
        String response = mockMvc.perform(multipart("/workspaces/{workspaceId}/items/attachments", workspaceId)
                        .file(file).param("title", "Attachment").cookie(cookie(owner)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("itemId").asText());
    }

    private int count(String table, UUID id) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE "
                + ("item".equals(table) ? "id" : "item_id") + " = ?", Integer.class, id);
    }

    private byte[] tinyPng() throws Exception {
        return java.util.Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p+8AAAAASUVORK5CYII=");
    }
}
