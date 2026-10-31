package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.entity.User;
import com.vaulty.api.storage.ObjectStorage;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;

class WorkspaceItemAttachmentIntegrationTest extends WorkspaceIntegrationSupport {

    private static final int MAX_FILE_SIZE = 20_000_000;

    @Autowired private ObjectMapper objectMapper;
    @MockBean private ObjectStorage storage;

    @Test
    void acceptsDecimalTwentyMegabytesAndRejectsLargerOrUnsupportedReplacementWithoutLosingCurrentFile()
            throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        Map<String, byte[]> objects = new ConcurrentHashMap<>();
        doAnswer(invocation -> {
            objects.put(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(storage).put(anyString(), any(byte[].class), anyString());
        doAnswer(invocation -> objects.get(invocation.getArgument(0)))
                .when(storage).get(anyString());
        doAnswer(invocation -> {
            objects.remove(invocation.getArgument(0));
            return null;
        }).when(storage).delete(anyString());

        UUID itemId = createAttachment(owner, workspaceId, "original.txt", "previous attachment".getBytes(StandardCharsets.UTF_8));
        byte[] boundary = new byte[MAX_FILE_SIZE];
        boundary[0] = (byte) 'b';
        replaceAttachment(owner, workspaceId, itemId, "boundary.txt", boundary)
                .andExpect(status().isOk());
        assertThat(jdbcTemplate.queryForObject("SELECT size_bytes FROM item_file WHERE item_id = ?", Long.class, itemId))
                .isEqualTo(20_000_000L);
        assertCurrentAttachment(owner, workspaceId, itemId, MAX_FILE_SIZE, (byte) 'b');

        replaceAttachment(owner, workspaceId, itemId, "too-large.txt", new byte[MAX_FILE_SIZE + 1])
                .andExpect(status().isBadRequest());
        assertCurrentAttachment(owner, workspaceId, itemId, MAX_FILE_SIZE, (byte) 'b');

        replaceAttachment(owner, workspaceId, itemId, "unsupported.exe", "not allowed".getBytes(StandardCharsets.UTF_8))
                .andExpect(status().isBadRequest());
        assertCurrentAttachment(owner, workspaceId, itemId, MAX_FILE_SIZE, (byte) 'b');
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM item_file WHERE item_id = ?", Integer.class, itemId))
                .isOne();
    }

    @Test
    void storageFailureDuringReplacementKeepsPreviousAttachmentAvailable() throws Exception {
        User owner = createUser();
        UUID workspaceId = configureWorkspace(owner).id();
        Map<String, byte[]> objects = new ConcurrentHashMap<>();
        doAnswer(invocation -> {
            objects.put(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(storage).put(anyString(), any(byte[].class), anyString());
        doAnswer(invocation -> objects.get(invocation.getArgument(0)))
                .when(storage).get(anyString());
        doAnswer(invocation -> {
            objects.remove(invocation.getArgument(0));
            return null;
        }).when(storage).delete(anyString());

        UUID itemId = createAttachment(owner, workspaceId, "original.txt", "previous attachment".getBytes(StandardCharsets.UTF_8));
        String oldKey = jdbcTemplate.queryForObject("SELECT storage_key FROM item_file WHERE item_id = ?", String.class, itemId);
        doThrow(new IllegalStateException("storage unavailable"))
                .when(storage).put(org.mockito.ArgumentMatchers.argThat(key -> !key.equals(oldKey)),
                        any(byte[].class), anyString());

        replaceAttachment(owner, workspaceId, itemId, "replacement.txt", "new bytes".getBytes(StandardCharsets.UTF_8))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message")
                        .value("Não foi possível substituir o anexo; o arquivo anterior continua disponível."));

        assertCurrentAttachment(owner, workspaceId, itemId, "previous attachment".length(), (byte) 'p');
        assertThat(jdbcTemplate.queryForObject("SELECT storage_key FROM item_file WHERE item_id = ?", String.class, itemId))
                .isEqualTo(oldKey);
        verify(storage, never()).delete(oldKey);
    }

    private UUID createAttachment(User owner, UUID workspaceId, String filename, byte[] bytes) throws Exception {
        String response = mockMvc.perform(multipart("/workspaces/{workspaceId}/items/attachments", workspaceId)
                        .file(new MockMultipartFile("file", filename, "text/plain", bytes))
                        .param("title", "Attachment")
                        .cookie(authCookie(owner)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(response).get("itemId").asText());
    }

    private org.springframework.test.web.servlet.ResultActions replaceAttachment(
            User owner, UUID workspaceId, UUID itemId, String filename, byte[] bytes) throws Exception {
        return mockMvc.perform(multipart("/workspaces/{workspaceId}/items/{itemId}/attachment", workspaceId, itemId)
                .file(new MockMultipartFile("file", filename, "text/plain", bytes))
                .with(request -> {
                    request.setMethod("PUT");
                    return request;
                })
                .cookie(authCookie(owner)));
    }

    private void assertCurrentAttachment(User owner, UUID workspaceId, UUID itemId, int expectedSize,
                                         byte expectedFirstByte) throws Exception {
        byte[] response = mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/attachment", workspaceId, itemId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(response).hasSize(expectedSize);
        if (expectedSize > 0) assertThat(response[0]).isEqualTo(expectedFirstByte);
    }
}
