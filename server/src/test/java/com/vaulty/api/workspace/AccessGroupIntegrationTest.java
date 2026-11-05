package com.vaulty.api.workspace;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class AccessGroupIntegrationTest extends WorkspaceIntegrationSupport {

    @Test
    void legacyGroupEndpointsAreGoneForReadsAndWrites() throws Exception {
        User owner = createUser("Owner");
        var workspace = configureWorkspace(owner);
        String groups = "/workspaces/{workspaceId}/groups";
        String group = groups + "/{groupId}";
        String members = group + "/members";
        var cookie = authCookie(owner);

        mockMvc.perform(get(groups, workspace.id()).cookie(cookie)).andExpect(status().isGone());
        mockMvc.perform(post(groups, workspace.id()).cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Readers\"}"))
                .andExpect(status().isGone());
        mockMvc.perform(get(members, workspace.id(), java.util.UUID.randomUUID()).cookie(cookie))
                .andExpect(status().isGone());
        mockMvc.perform(put(group + "/members/{memberId}", workspace.id(), java.util.UUID.randomUUID(),
                        java.util.UUID.randomUUID()).cookie(cookie))
                .andExpect(status().isGone());
        mockMvc.perform(delete(group, workspace.id(), java.util.UUID.randomUUID()).cookie(cookie))
                .andExpect(status().isGone());
    }
}
