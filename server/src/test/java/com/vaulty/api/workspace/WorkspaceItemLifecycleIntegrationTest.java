package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.entity.User;
import com.vaulty.api.exception.AttachmentStorageException;
import com.vaulty.api.service.AttachmentStorage;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.mockito.Mockito;

class WorkspaceItemLifecycleIntegrationTest extends WorkspaceIntegrationSupport {
    @Autowired private ObjectMapper objectMapper;
    @MockBean private AttachmentStorage storage;

    @Test
    void memberEditsArchivesRestoresAndDeletesAnItem() throws Exception {
        User owner = createUser();
        User member = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(member, workspaceId);
        var cookie = authCookie(member);
        String created = mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"text\",\"title\":\" Guia \",\"textContent\":\"A\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID itemId = UUID.fromString(objectMapper.readTree(created).get("id").asText());

        mockMvc.perform(put("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\" Guia novo \",\"description\":\"Procedimento\",\"textContent\":\"B\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Guia novo"))
                .andExpect(jsonPath("$.description").value("Procedimento"));
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie).param("confirm", "true"))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/workspaces/{workspaceId}/items/{itemId}/archive", workspaceId, itemId)
                        .cookie(cookie)).andExpect(status().isOk())
                .andExpect(jsonPath("$.archivedAt").isNotEmpty());
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId).cookie(cookie))
                .andExpect(jsonPath("$.totalItems").value(0));
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(cookie).param("includeArchived", "true"))
                .andExpect(jsonPath("$.totalItems").value(1));
        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                        .cookie(cookie).param("q", "guia"))
                .andExpect(jsonPath("$.totalItems").value(0));
        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId)
                        .cookie(cookie).param("q", "guia").param("includeArchived", "true"))
                .andExpect(jsonPath("$.totalItems").value(1));
        mockMvc.perform(post("/workspaces/{workspaceId}/items/{itemId}/archive", workspaceId, itemId)
                        .cookie(cookie)).andExpect(status().isConflict());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId).cookie(cookie))
                .andExpect(status().isOk());
        mockMvc.perform(put("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Bloqueado\",\"textContent\":\"B\"}"))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/workspaces/{workspaceId}/items/{itemId}/restore", workspaceId, itemId)
                        .cookie(cookie)).andExpect(status().isOk());
        mockMvc.perform(post("/workspaces/{workspaceId}/items/{itemId}/restore", workspaceId, itemId)
                        .cookie(cookie)).andExpect(status().isConflict());
        mockMvc.perform(post("/workspaces/{workspaceId}/items/{itemId}/archive", workspaceId, itemId)
                        .cookie(cookie)).andExpect(status().isOk());
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie)).andExpect(status().isBadRequest());
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(cookie).param("confirm", "true"))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId).cookie(cookie))
                .andExpect(status().isNotFound());
    }

    @Test
    void createsDocumentAndKeepsOldAttachmentWhenReplacementFails() throws Exception {
        User owner = createUser();
        User member = createUser();
        User outsider = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(member, workspaceId);
        byte[] pdf = "%PDF-1.7\nconteúdo".getBytes(StandardCharsets.UTF_8);
        var metadata = new MockMultipartFile("metadata", "metadata.json", "application/json",
                "{\"title\":\"Manual\",\"description\":\"Guia\"}".getBytes(StandardCharsets.UTF_8));
        var upload = new MockMultipartFile("file", "manual.pdf", "application/pdf", pdf);
        String created = mockMvc.perform(multipart("/workspaces/{workspaceId}/items/documents", workspaceId)
                        .file(metadata).file(upload).cookie(authCookie(member)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("file"))
                .andExpect(jsonPath("$.attachment.originalName").value("manual.pdf"))
                .andReturn().getResponse().getContentAsString();
        UUID itemId = UUID.fromString(objectMapper.readTree(created).get("id").asText());
        String oldKey = jdbcTemplate.queryForObject("SELECT storage_key FROM item_file WHERE item_id = ?",
                String.class, itemId);
        org.mockito.Mockito.when(storage.get(oldKey)).thenReturn(pdf);
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/attachment", workspaceId, itemId)
                        .cookie(authCookie(member)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/attachment", workspaceId, itemId)
                        .cookie(authCookie(outsider)))
                .andExpect(status().isNotFound());

        doThrow(new AttachmentStorageException()).when(storage).put(anyString(), any(byte[].class), anyString());
        mockMvc.perform(multipart("/workspaces/{workspaceId}/items/{itemId}/attachment", workspaceId, itemId)
                        .file(new MockMultipartFile("file", "novo.pdf", "application/pdf", pdf))
                        .with(request -> { request.setMethod("PUT"); return request; })
                        .cookie(authCookie(member)))
                .andExpect(status().isServiceUnavailable());
        assertThat(jdbcTemplate.queryForObject("SELECT storage_key FROM item_file WHERE item_id = ?",
                String.class, itemId)).isEqualTo(oldKey);

        Mockito.reset(storage);
        mockMvc.perform(multipart("/workspaces/{workspaceId}/items/{itemId}/attachment", workspaceId, itemId)
                        .file(new MockMultipartFile("file", "novo.pdf", "application/pdf", pdf))
                        .with(request -> { request.setMethod("PUT"); return request; })
                        .cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attachment.originalName").value("novo.pdf"));
        assertThat(jdbcTemplate.queryForObject("SELECT storage_key FROM item_file WHERE item_id = ?",
                String.class, itemId)).isNotEqualTo(oldKey);
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM attachment_cleanup WHERE storage_key = ?",
                Integer.class, oldKey)).isEqualTo(1);

        String currentKey = jdbcTemplate.queryForObject("SELECT storage_key FROM item_file WHERE item_id = ?",
                String.class, itemId);
        mockMvc.perform(post("/workspaces/{workspaceId}/items/{itemId}/archive", workspaceId, itemId)
                        .cookie(authCookie(member)))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/workspaces/{workspaceId}/items/{itemId}", workspaceId, itemId)
                        .cookie(authCookie(member)).param("confirm", "true"))
                .andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM item_file WHERE item_id = ?",
                Integer.class, itemId)).isZero();
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM attachment_cleanup WHERE storage_key = ?",
                Integer.class, currentKey)).isEqualTo(1);
    }

    @Test
    void preservesSecretWhenEditingMetadataAndCreatesImageMedia() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        var cookie = authCookie(owner);
        String secret = mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"secret\",\"title\":\"Chave\",\"value\":\"  valor  \"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID secretId = UUID.fromString(objectMapper.readTree(secret).get("id").asText());
        mockMvc.perform(put("/workspaces/{workspaceId}/items/{itemId}", workspaceId, secretId)
                        .cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Chave nova\",\"description\":\"Uso interno\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.value").doesNotExist());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, secretId)
                        .cookie(cookie)).andExpect(jsonPath("$.value").value("  valor  "));
        mockMvc.perform(put("/workspaces/{workspaceId}/items/{itemId}", workspaceId, secretId)
                        .cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Chave nova\",\"description\":\"Uso interno\",\"value\":\" novo \"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, secretId)
                        .cookie(cookie)).andExpect(jsonPath("$.value").value(" novo "));

        var png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), "png", png);
        String created = mockMvc.perform(multipart("/workspaces/{workspaceId}/items/documents", workspaceId)
                        .file(new MockMultipartFile("metadata", "metadata.json", "application/json",
                                "{\"title\":\"Diagrama\"}".getBytes(StandardCharsets.UTF_8)))
                        .file(new MockMultipartFile("file", "diagrama.png", "image/png", png.toByteArray()))
                        .cookie(cookie))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("image"))
                .andReturn().getResponse().getContentAsString();
        UUID imageId = UUID.fromString(objectMapper.readTree(created).get("id").asText());
        assertThat(jdbcTemplate.queryForObject("SELECT width_px FROM item_media WHERE item_id = ?",
                Integer.class, imageId)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("SELECT height_px FROM item_media WHERE item_id = ?",
                Integer.class, imageId)).isEqualTo(3);
    }
}
