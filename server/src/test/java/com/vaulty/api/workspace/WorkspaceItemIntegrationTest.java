package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.dto.item.CreateItemRequest;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.WorkspaceRole;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class WorkspaceItemIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private ObjectMapper objectMapper;

    @Test
    void createsAndPaginatesTextsAndLinksInRootAndFolder() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID folderId = createFolder(owner, workspaceId, "Projetos");
        createItem(owner, workspaceId, "text", "Alpha", null, "Conteúdo", null, null);
        createItem(owner, workspaceId, "link", "Beta", null, null, "https://example.com", null);
        createItem(owner, workspaceId, "text", "Dentro", folderId, "Pasta", null, null);

        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(owner)).param("page", "0").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Alpha"))
                .andExpect(jsonPath("$.items[0].textContent").isEmpty())
                .andExpect(jsonPath("$.totalItems").value(2));

        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(owner)).param("collectionId", folderId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Dentro"))
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test
    void validatesTypeUrlDuplicateTitleAndFolderDeletion() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID folderId = createFolder(owner, workspaceId, "Documentos");
        createItem(owner, workspaceId, "text", "Mesmo", folderId, "A", null, null);

        var cookie = authCookie(owner);
        mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"link\",\"title\":\"Ruim\",\"linkUrl\":\"ftp://example.com\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"file\",\"title\":\"Ainda não\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(delete("/workspaces/{workspaceId}/collections/{collectionId}", workspaceId, folderId)
                        .cookie(cookie))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"text\",\"title\":\"Mesmo\",\"textContent\":\"B\",\"collectionId\":\"" + folderId + "\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void memberReadsNormalItemsButCannotCreateOrSeeSecrets() throws Exception {
        User owner = createUser();
        User member = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(member, workspaceId);
        UUID memberRoleId = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, member.getId())
                .orElseThrow().getRole().getId();
        assertThat(jdbcTemplate.queryForList(
                        "SELECT resource FROM role_permission WHERE role_id = ? AND action = 'read'",
                        String.class, memberRoleId))
                .containsExactlyInAnyOrder("item", "collection");
        UUID textId = createItem(owner, workspaceId, "text", "Guia", null, "Ler", null, null);
        UUID secretId = createItem(owner, workspaceId, "secret", "Chave API", null, null, null, "valor-privado");

        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, textId)
                        .cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.textContent").value("Ler"));
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1));
        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                        .cookie(authCookie(member)).param("q", "chave"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0));
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, secretId)
                        .cookie(authCookie(member)))
                .andExpect(status().isForbidden());
        for (UUID unavailableId : new UUID[] {secretId, UUID.randomUUID()}) {
            mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, unavailableId)
                            .cookie(authCookie(member)))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.message").value("Item indisponível"));
        }
        mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(member)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"text\",\"title\":\"Proibido\",\"textContent\":\"x\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void searchesTitlesWithoutExposingSecretValueAndDecryptsOnlyOnReveal() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID folderId = createFolder(owner, workspaceId, "Infra");
        UUID secretId = createItem(owner, workspaceId, "secret", "Chave API", folderId, null, null, "valor-privado");
        createItem(owner, workspaceId, "text", "Manual API", null, "valor-privado", null, null);

        String stored = jdbcTemplate.queryForObject("SELECT value FROM item_secret WHERE item_id = ?", String.class, secretId);
        assertThat(stored).doesNotContain("valor-privado");

        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                        .cookie(authCookie(owner)).param("q", "api").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].textContent").isEmpty())
                .andExpect(jsonPath("$.items[0].value").doesNotExist());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                        .cookie(authCookie(owner)).param("q", "valor-privado"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0));
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, secretId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").doesNotExist());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, secretId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("valor-privado"));
    }

    @Test
    void searchesAllCompleteWordsInAnyOrderIgnoringCaseAndAccents() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        createItem(owner, workspaceId, "text", "Chave da API de Produção", null, "A", null, null);
        createItem(owner, workspaceId, "text", "Produção de API", null, "B", null, null);
        createItem(owner, workspaceId, "text", "API de Homologação", null, "C", null, null);
        createItem(owner, workspaceId, "text", "API Producaox", null, "D", null, null);
        UUID archivedId = createItem(owner, workspaceId, "text", "API Produção arquivada", null, "E", null, null);
        jdbcTemplate.update("UPDATE item SET archived_at = now() WHERE id = ?", archivedId);

        for (String term : new String[] {"api producao", "PRODUÇÃO API", "producao", "PRODUÇÃO"}) {
            mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                            .cookie(authCookie(owner)).param("q", term).param("size", "1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[0].title").value("Chave da API de Produção"))
                    .andExpect(jsonPath("$.totalItems").value(2))
                    .andExpect(jsonPath("$.totalPages").value(2));
        }
        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                        .cookie(authCookie(owner)).param("q", "api producao").param("page", "1").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Produção de API"))
                .andExpect(jsonPath("$.totalItems").value(2));
        for (String term : new String[] {"ap produ", "senah banco", "api prod", "%", "_", "!"}) {
            mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                            .cookie(authCookie(owner)).param("q", term))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalItems").value(0));
        }
    }

    @Test
    void rejectsInvalidContentWithoutPersistingAnItemOrSecret() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        CreateItemRequest[] requests = {
            new CreateItemRequest("text", "Blank", null, "   ", null, null),
            new CreateItemRequest("text", "Empty", null, "", null, null),
            new CreateItemRequest("text", "Too long", null, "x".repeat(100001), null, null),
            new CreateItemRequest("secret", "Too long", null, null, null, "x".repeat(8193)),
            new CreateItemRequest("secret", "Blank", null, null, null, "  "),
            new CreateItemRequest("text", "Mixed", null, "text", null, "secret"),
            new CreateItemRequest("link", "Mixed", null, "text", "https://example.com", null)
        };
        for (var request : requests) {
            mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                            .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM item", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM item_secret", Integer.class)).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://", "http://", "ftp://example.com", "https://example.com/a b",
            "https:///path", "https://example.com:65536", "https://example.com:bad", "//example.com"})
    void rejectsIncompleteOrMalformedUrls(String url) throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        var request = new CreateItemRequest("link", "Invalid", null, null, url, null);
        mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM item", Integer.class)).isZero();
    }

    @Test
    void acceptsExactLimitsAndPreservesTextAndSecretContent() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        String text = "  # Guia\n\n" + "x".repeat(99990);
        String value = "  " + "é".repeat(8188) + "  ";
        String url = "https://intranet/" + "a".repeat(2031);
        UUID textId = createItem(owner, workspaceId, "text", "Texto", null, text, null, null);
        UUID secretId = createItem(owner, workspaceId, "secret", "Segredo", null, null, null, value);
        UUID linkId = createItem(owner, workspaceId, "link", "Link", null, null, url, null);
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, textId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.textContent").value(text));
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, secretId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.value").value(value));
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, linkId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.linkUrl").value(url));
        var tooLong = new CreateItemRequest("link", "Too long", null, null, url + "a", null);
        mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(tooLong)))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://intranet", "https://localhost:8443/path", "https://192.168.1.1/a%20b",
            "http://[::1]:8080/", "HTTPS://example.com/path?q=one%20two#fragment"})
    void acceptsCompleteInternalAndPublicUrls(String url) throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        createItem(owner, workspaceId, "link", "Link", null, null, url, null);
    }

    @ParameterizedTest
    @ValueSource(strings = {"chave de produção", " Chave de Producao ", "Chave de Produção"})
    void rejectsEquivalentTitlesAtRootIncludingAnArchivedItem(String duplicateTitle) throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID itemId = createItem(owner, workspaceId, "text", "Chave de Produção", null, "A", null, null);
        jdbcTemplate.update("UPDATE item SET archived_at = now() WHERE id = ?", itemId);
        var request = new CreateItemRequest("text", duplicateTitle, null, "B", null, null);
        mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Título indisponível nesta localização"));
    }

    @Test
    void acceptsEquivalentTitlesInDifferentLocationsAndPreservesPresentation() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID folderId = createFolder(owner, workspaceId, "Pasta");
        UUID itemId = createItem(owner, workspaceId, "text", "  Chave de Produção  ", null, "A", null, null);
        createItem(owner, workspaceId, "text", "chave de producao", folderId, "B", null, null);
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Chave de Produção"));
    }

    @Test
    void rolePermissionsControlSecretSearchAndReveal() throws Exception {
        User owner = createUser();
        User developer = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(developer, workspaceId);
        UUID secretId = createItem(owner, workspaceId, "secret", "Token Produção", null, null, null, "segredo");
        var role = new WorkspaceRole();
        role.setWorkspace(workspaceRepository.findById(workspaceId).orElseThrow());
        role.setName("Developer");
        role = workspaceRoleRepository.saveAndFlush(role);
        var membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, developer.getId()).orElseThrow();
        membership.setRole(role);
        workspaceMemberRepository.saveAndFlush(membership);
        jdbcTemplate.update("INSERT INTO role_permission (role_id, resource, action) VALUES (?, 'item', 'read')", role.getId());
        jdbcTemplate.update("INSERT INTO role_permission (role_id, resource, action) VALUES (?, 'secret', 'read')", role.getId());
        jdbcTemplate.update("INSERT INTO role_permission (role_id, resource, action) VALUES (?, 'item', 'create')", role.getId());

        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                        .cookie(authCookie(developer)).param("q", "token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1));
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, secretId)
                        .cookie(authCookie(developer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("segredo"));
        mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(developer)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"secret\",\"title\":\"Sem criação\",\"value\":\"x\"}"))
                .andExpect(status().isForbidden());

        jdbcTemplate.update("INSERT INTO role_permission (role_id, resource, action) VALUES (?, 'secret', 'create')", role.getId());
        UUID createdId = createItem(developer, workspaceId, "secret", "Nova chave", null, null, null, "novo-valor");
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, createdId)
                        .cookie(authCookie(developer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("novo-valor"));
    }

    @Test
    void rejectsInvalidSearchPaginationAndMissingAuthentication() throws Exception {
        User owner = createUser();
        User outsider = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID itemId = createItem(owner, workspaceId, "text", "Privado", null, "conteúdo", null, null);

        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                        .cookie(authCookie(owner)).param("q", " "))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(owner)).param("size", "101"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(authCookie(outsider)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                        .cookie(authCookie(outsider)).param("q", "Privado"))
                .andExpect(status().isNotFound());
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
        JsonNode result = objectMapper.readTree(response);
        return UUID.fromString(result.get("id").asText());
    }
}
