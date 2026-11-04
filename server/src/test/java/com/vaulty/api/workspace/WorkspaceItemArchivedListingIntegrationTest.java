package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.entity.User;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class WorkspaceItemArchivedListingIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private ObjectMapper objectMapper;

    @Test
    void archivedParamReturnsOnlyArchivedAndDefaultReturnsOnlyActive() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID activeId = createItem(owner, workspaceId, "text", "Ativo", null, "a", null, null);
        UUID archivedId = createItem(owner, workspaceId, "link", "Arquivado", null, null, "https://example.com", null);
        archive(owner, workspaceId, archivedId);

        assertThat(listIds(owner, workspaceId, null, "true")).containsExactly(archivedId);
        assertThat(listIds(owner, workspaceId, null, "false")).containsExactly(activeId);
        assertThat(listIds(owner, workspaceId, null, null)).containsExactly(activeId);
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(owner)).param("archived", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].archivedAt").isNotEmpty());
    }

    @Test
    void archivedListingIsScopedToRootOrFolderAndPaginated() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID folderId = createFolder(owner, workspaceId, "Pasta");
        UUID rootA = createItem(owner, workspaceId, "text", "Raiz A", null, "a", null, null);
        UUID rootB = createItem(owner, workspaceId, "text", "Raiz B", null, "b", null, null);
        UUID inFolder = createItem(owner, workspaceId, "text", "Na pasta", folderId, "c", null, null);
        for (UUID id : List.of(rootA, rootB, inFolder)) archive(owner, workspaceId, id);

        assertThat(listIds(owner, workspaceId, null, "true")).containsExactlyInAnyOrder(rootA, rootB);
        assertThat(listIds(owner, workspaceId, folderId, "true")).containsExactly(inFolder);
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(owner)).param("archived", "true")
                        .param("page", "0").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.totalItems").value(2));
    }

    @Test
    void memberWithoutSharingDoesNotSeeArchivedItemsOfForeignFolderButOwnerDoes() throws Exception {
        User owner = createUser();
        User member = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(member, workspaceId);
        UUID privateFolder = createFolder(owner, workspaceId, "Privada");
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/inheritance",
                        workspaceId, privateFolder).cookie(authCookie(owner)).param("enabled", "false"))
                .andExpect(status().isNoContent());
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/everyone",
                        workspaceId, privateFolder).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/workspaces/{workspaceId}/sharing/collections/{collectionId}/everyone",
                        workspaceId, privateFolder).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        UUID hidden = createItem(owner, workspaceId, "text", "Oculto", privateFolder, "x", null, null);
        UUID rootArchived = createItem(owner, workspaceId, "text", "Raiz arquivada", null, "y", null, null);
        archive(owner, workspaceId, hidden);
        archive(owner, workspaceId, rootArchived);

        assertThat(listIds(owner, workspaceId, privateFolder, "true")).containsExactly(hidden);
        assertThat(listIds(owner, workspaceId, null, "true")).containsExactly(rootArchived);
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(member)).param("collectionId", privateFolder.toString())
                        .param("archived", "true"))
                .andExpect(status().isNotFound());
        assertThat(listIds(member, workspaceId, null, "true")).containsExactly(rootArchived);
    }

    @Test
    void archivedSecretIsHiddenWithoutSecretReadAndNeverExposesValue() throws Exception {
        User owner = createUser();
        User member = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(member, workspaceId);
        UUID secretId = createItem(owner, workspaceId, "secret", "Token", null, null, null, "valor-super-secreto");
        UUID textId = createItem(owner, workspaceId, "text", "Nota", null, "n", null, null);
        archive(owner, workspaceId, secretId);
        archive(owner, workspaceId, textId);

        assertThat(listIds(owner, workspaceId, null, "true")).containsExactlyInAnyOrder(secretId, textId);
        assertThat(listIds(member, workspaceId, null, "true")).containsExactly(textId);
        String ownerBody = mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(owner)).param("archived", "true"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(ownerBody).doesNotContain("valor-super-secreto");
    }

    @Test
    void archivedAtChangesWithArchiveAndRestoreAndSearchIgnoresArchived() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID itemId = createItem(owner, workspaceId, "text", "Manual unico", null, "c", null, null);
        var cookie = authCookie(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId).cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.archivedAt").isEmpty());

        archive(owner, workspaceId, itemId);
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId).cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.archivedAt").isNotEmpty());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                        .cookie(cookie).param("q", "Manual unico"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));

        mockMvc.perform(post("/workspaces/{workspaceId}/items/{itemId}/restore", workspaceId, itemId).cookie(cookie))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId).cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.archivedAt").isEmpty());
        assertThat(listIds(owner, workspaceId, null, "true")).isEmpty();
        assertThat(listIds(owner, workspaceId, null, "false")).containsExactly(itemId);
        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                        .cookie(cookie).param("q", "Manual unico"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].archivedAt").isEmpty());
    }

    private void archive(User user, UUID workspaceId, UUID itemId) throws Exception {
        mockMvc.perform(post("/workspaces/{workspaceId}/items/{itemId}/archive", workspaceId, itemId)
                        .cookie(authCookie(user)))
                .andExpect(status().isNoContent());
    }

    private List<UUID> listIds(User user, UUID workspaceId, UUID collectionId, String archived) throws Exception {
        var request = get("/workspaces/{workspaceId}/items", workspaceId).cookie(authCookie(user));
        if (collectionId != null) request.param("collectionId", collectionId.toString());
        if (archived != null) request.param("archived", archived);
        String response = mockMvc.perform(request).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<UUID> ids = new ArrayList<>();
        for (JsonNode item : objectMapper.readTree(response).get("items")) {
            ids.add(UUID.fromString(item.get("id").asText()));
        }
        return ids;
    }

    private UUID createFolder(User owner, UUID workspaceId, String name) throws Exception {
        String response = mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(response).get("id").asText());
    }

    private UUID createItem(User owner, UUID workspaceId, String type, String title, UUID collectionId,
                            String textContent, String linkUrl, String value) throws Exception {
        var body = objectMapper.createObjectNode();
        body.put("type", type);
        body.put("title", title);
        if (collectionId != null) body.put("collectionId", collectionId.toString());
        if (textContent != null) body.put("textContent", textContent);
        if (linkUrl != null) body.put("linkUrl", linkUrl);
        if (value != null) body.put("value", value);
        String response = mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(response).get("id").asText());
    }
}
