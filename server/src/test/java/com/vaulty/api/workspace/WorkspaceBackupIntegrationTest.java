package com.vaulty.api.workspace;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.entity.User;
import com.vaulty.api.service.WorkspaceBackupService;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;

class WorkspaceBackupIntegrationTest extends WorkspaceIntegrationSupport {

    @MockBean private WorkspaceBackupService backupService;

    @Test
    void ownerCanDownloadSingleZipBackup() throws Exception {
        User owner = createUser("Proprietário");
        configureWorkspace(owner);
        Path archive = Files.createTempFile("vaulty-backup-test-", ".zip");
        Files.write(archive, new byte[] { 'P', 'K', 3, 4 });
        WorkspaceBackupService.BackupFile backup = mock(WorkspaceBackupService.BackupFile.class);
        when(backup.path()).thenReturn(archive);
        when(backupService.create(owner.getId())).thenReturn(backup);

        try {
            mockMvc.perform(post("/workspaces/backup").cookie(authCookie(owner)))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType("application/zip"))
                    .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("vaulty-backup.zip")))
                    .andExpect(content().bytes(new byte[] { 'P', 'K', 3, 4 }));
            verify(backupService).create(owner.getId());
        } finally {
            Files.deleteIfExists(archive);
        }
    }
}
