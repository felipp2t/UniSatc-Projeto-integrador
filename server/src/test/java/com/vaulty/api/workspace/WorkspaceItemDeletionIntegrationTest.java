package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.enums.GlobalRole;
import com.vaulty.api.mapper.WorkspaceMapper;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
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
            memberRepository.saveAndFlush(workspaceMapper.toMember(admin, workspace));
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
    void maintainerCanReadButCannotDeleteSecretWhileAdminCanDeleteIt() throws Exception {
        User owner = user("owner");
        UUID workspaceId = workspace(owner);
        User member = user("member");
        UUID itemId = createSecret(owner, workspaceId, "Hidden secret", "private-value");
        addMember(member, workspaceId);
        var membership = memberRepository.findByUserId(member.getId()).orElseThrow();
        membership.setGlobalRole(GlobalRole.MAINTAINER);
        memberRepository.saveAndFlush(membership);
        jdbc.update("UPDATE item SET archived_at = now() WHERE id = ?", itemId);

        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, itemId)
                        .cookie(cookie(member)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.value").value("private-value"));
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie(member)).param("confirm", "true"))
                .andExpect(status().isForbidden());
        assertThat(count("item", itemId)).isOne();

        membership.setGlobalRole(GlobalRole.ADMIN);
        memberRepository.saveAndFlush(membership);
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie(member)).param("confirm", "true"))
                .andExpect(status().isNoContent());
        assertThat(count("item", itemId)).isZero();
        assertThat(count("item_secret", itemId)).isZero();
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

    @Test
    void documentDescriptionPersistsOnCreateAndSurvivesAttachmentReplacement() throws Exception {
        User owner = user("owner");
        UUID workspaceId = workspace(owner);
        MockMultipartFile initial = new MockMultipartFile("file", "guide.png", "image/png", tinyPng());
        String response = mockMvc.perform(multipart("/workspaces/{workspaceId}/items/attachments", workspaceId)
                        .file(initial).param("title", "Guide").param("description", "  Uso interno  ")
                        .cookie(cookie(owner)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        UUID itemId = UUID.fromString(new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(response).get("itemId").asText());

        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId).cookie(cookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.description").value("Uso interno"));
        mockMvc.perform(put("/workspaces/{workspaceId}/items/{itemId}/metadata", workspaceId, itemId)
                        .cookie(cookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Guide atualizado\",\"description\":\"Nova finalidade\"}"))
                .andExpect(status().isNoContent());
        MockMultipartFile replacement = new MockMultipartFile("file", "guide-updated.png", "image/png", tinyPng());
        mockMvc.perform(multipart("/workspaces/{workspaceId}/items/{itemId}/attachment", workspaceId, itemId)
                        .file(replacement).with(request -> {
                            request.setMethod("PUT");
                            return request;
                        }).cookie(cookie(owner)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId).cookie(cookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Guide atualizado"))
                .andExpect(jsonPath("$.description").value("Nova finalidade"));
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
        memberRepository.saveAndFlush(workspaceMapper.toMember(owner, workspace));
        return workspace.getId();
    }

    private void addMember(User user, UUID workspaceId) {
        Workspace workspace = workspaceRepository.findById(workspaceId).orElseThrow();
        WorkspaceMember member = workspaceMapper.toMember(user, workspace);
        memberRepository.saveAndFlush(member);
    }

    private Cookie cookie(User user) {
        WorkspaceMember membership = memberRepository.findByUserId(user.getId()).orElseThrow();
        return new Cookie("accessToken", jwtService.generateAccessToken(
                user.getId(), membership.getId(), null));
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
