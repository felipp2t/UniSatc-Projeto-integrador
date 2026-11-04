package com.vaulty.api.workspace;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.entity.User;
import org.junit.jupiter.api.Test;

class WorkspaceBackupAuthorizationIntegrationTest extends WorkspaceIntegrationSupport {

    @Test
    void memberCannotGenerateBackupEvenWhenWorkspaceIsAccessible() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());

        mockMvc.perform(post("/workspaces/backup").cookie(authCookie(member)))
                .andExpect(status().isForbidden());
    }
}
