package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.dto.collection.CreateCollectionRequest;
import com.vaulty.api.entity.User;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;

class WorkspaceCollectionIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private ObjectMapper objectMapper;

    @Test
    void ownerCreatesNestedFoldersAndReadsTheirPath() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID rootId = createFolder(owner, workspaceId, "Engenharia", null);
        UUID childId = createFolder(owner, workspaceId, "Projetos", rootId);
        UUID leafId = createFolder(owner, workspaceId, "Vaulty", childId);

        mockMvc.perform(get("/workspaces/{workspaceId}/collections/{collectionId}/path", workspaceId, leafId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(rootId.toString()))
                .andExpect(jsonPath("$[0].name").value("Engenharia"))
                .andExpect(jsonPath("$[1].id").value(childId.toString()))
                .andExpect(jsonPath("$[1].name").value("Projetos"))
                .andExpect(jsonPath("$[2].id").value(leafId.toString()))
                .andExpect(jsonPath("$[2].name").value("Vaulty"));
    }

    @Test
    void paginatesRootAndDirectChildrenSeparately() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID alphaId = createFolder(owner, workspaceId, "Alpha", null);
        createFolder(owner, workspaceId, "Beta", null);
        createFolder(owner, workspaceId, "Gamma", null);
        createFolder(owner, workspaceId, "Child A", alphaId);
        createFolder(owner, workspaceId, "Child B", alphaId);

        mockMvc.perform(get("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(owner)).param("page", "0").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].name").value("Alpha"))
                .andExpect(jsonPath("$.items[1].name").value("Beta"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));

        mockMvc.perform(get("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(owner)).param("page", "1").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].name").value("Gamma"));

        mockMvc.perform(get("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(owner)).param("parentId", alphaId.toString())
                        .param("page", "0").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].name").value("Child A"))
                .andExpect(jsonPath("$.items[0].parentId").value(alphaId.toString()))
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));

        mockMvc.perform(get("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(owner)).param("page", "3").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.totalItems").value(3));
    }

    @Test
    void rejectsInvalidPaginationParameters() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();

        for (String[] parameters : new String[][] {{"-1", "20"}, {"0", "0"}, {"0", "101"}}) {
            mockMvc.perform(get("/workspaces/{workspaceId}/collections", workspaceId)
                            .cookie(authCookie(owner))
                            .param("page", parameters[0]).param("size", parameters[1]))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400));
        }
    }

    @Test
    void rejectsDuplicateNamesInOneLevelButAllowsThemInDifferentLevels() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID rootId = createFolder(owner, workspaceId, "Projetos", null);
        createFolder(owner, workspaceId, "Projetos", rootId);

        mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"  Projetos  "}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void memberCanReadButCannotCreateFolders() throws Exception {
        User owner = createUser();
        User member = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(member, workspaceId);
        UUID folderId = createFolder(owner, workspaceId, "Compartilhado", null);

        mockMvc.perform(get("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(folderId.toString()));

        mockMvc.perform(get("/workspaces/{workspaceId}/collections/{collectionId}/path", workspaceId, folderId)
                        .cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Compartilhado"));

        mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Proibida"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void hidesFoldersFromUsersWithoutWorkspaceMembership() throws Exception {
        User owner = createUser();
        User outsider = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID folderId = createFolder(owner, workspaceId, "Privada", null);

        mockMvc.perform(get("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(outsider)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/workspaces/{workspaceId}/collections/{collectionId}/path", workspaceId, folderId)
                        .cookie(authCookie(outsider)))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsUnknownParentAndUnknownPath() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        UUID unknownId = UUID.randomUUID();

        mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateCollectionRequest("Child", unknownId))))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(owner)).param("parentId", unknownId.toString()))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/workspaces/{workspaceId}/collections/{collectionId}/path", workspaceId, unknownId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectsMissingAuthenticationAndMalformedJson() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();

        mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspaceId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Projetos"}
                                """))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Projetos" "parentId":null}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Corpo da requisição inválido"));
    }

    @Test
    void databaseRejectsDuplicateFolderNamesAtRoot() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        createFolder(owner, workspaceId, "Engenharia", null);

        assertThatThrownBy(() -> jdbcTemplate.update(
                        "INSERT INTO collection (id, workspace_id, name) VALUES (?, ?, ?)",
                        UUID.randomUUID(), workspaceId, "Engenharia"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("uq_collection_workspace_parent_name");
    }

    private UUID createFolder(User owner, UUID workspaceId, String name, UUID parentId) throws Exception {
        String response = mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateCollectionRequest(name, parentId))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.name").value(name))
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(response).get("id").asText());
    }
}
