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
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

class WorkspaceSharingIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private ObjectMapper objectMapper;

    @Test
    void sourceTeamLeaderPublishesItemToDestinationTeamAndCanRevokeIt() throws Exception {
        User owner = createUser("Owner");
        User sourceLeader = createUser("Source leader");
        User sourceMember = createUser("Source member");
        User destinationLeader = createUser("Destination leader");
        User destinationMember = createUser("Destination member");
        User unrelatedMember = createUser("Unassigned member");
        var workspace = configureWorkspace(owner);
        addMember(sourceLeader, workspace.id());
        addMember(sourceMember, workspace.id());
        addMember(destinationLeader, workspace.id());
        addMember(destinationMember, workspace.id());
        addMember(unrelatedMember, workspace.id());

        UUID sourceTeam = createTeam(owner, workspace.id(), "Source", memberId(workspace.id(), sourceLeader));
        UUID destinationTeam = createTeam(owner, workspace.id(), "Destination",
                memberId(workspace.id(), destinationLeader));
        UUID sourceRoot = teamRoot(sourceTeam, owner, workspace.id());
        addTeamMember(sourceLeader, workspace.id(), sourceTeam, memberId(workspace.id(), sourceMember));
        addTeamMember(destinationLeader, workspace.id(), destinationTeam,
                memberId(workspace.id(), destinationMember));
        UUID originalItem = createItem(owner, workspace.id(), sourceRoot, "Published item");

        mockMvc.perform(get("/workspaces/{workspaceId}/sharing/publications/configuration", workspace.id())
                        .cookie(authCookie(sourceLeader)).param("sourceCollectionId", sourceRoot.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.destinationTeams.length()").value(1))
                .andExpect(jsonPath("$.destinationTeams[0].id").value(destinationTeam.toString()))
                .andExpect(jsonPath("$.publications").isEmpty());

        MvcResult published = mockMvc.perform(post("/workspaces/{workspaceId}/sharing/publications", workspace.id())
                        .cookie(authCookie(sourceLeader)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "originalType", "ITEM", "originalId", originalItem,
                                "destinationTeamId", destinationTeam))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.originalType").value("ITEM"))
                .andExpect(jsonPath("$.originalId").value(originalItem.toString()))
                .andReturn();
        JsonNode publication = objectMapper.readTree(published.getResponse().getContentAsString());
        UUID publicationId = UUID.fromString(publication.get("id").asText());

        mockMvc.perform(get("/workspaces/{workspaceId}/received", workspace.id())
                        .cookie(authCookie(destinationLeader)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Published item"))
                .andExpect(jsonPath("$.items[0].received").value(true))
                .andExpect(jsonPath("$.items[0].readOnly").value(true));
        mockMvc.perform(get("/workspaces/{workspaceId}/received", workspace.id())
                        .cookie(authCookie(destinationMember)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        mockMvc.perform(get("/workspaces/{workspaceId}/received", workspace.id())
                        .cookie(authCookie(sourceMember)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        mockMvc.perform(get("/workspaces/{workspaceId}/received", workspace.id())
                        .cookie(authCookie(unrelatedMember)))
                .andExpect(status().isForbidden());

        UUID receivedId = UUID.fromString(objectMapper.readTree(mockMvc.perform(
                                get("/workspaces/{workspaceId}/received", workspace.id())
                                        .cookie(authCookie(destinationLeader)))
                        .andReturn().getResponse().getContentAsString())
                .get("items").get(0).get("id").asText());
        mockMvc.perform(get("/workspaces/{workspaceId}/received/{virtualId}", workspace.id(), receivedId)
                        .cookie(authCookie(destinationLeader)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Published item"));

        mockMvc.perform(delete("/workspaces/{workspaceId}/sharing/publications/{publicationId}",
                                workspace.id(), publicationId)
                        .cookie(authCookie(sourceLeader)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/workspaces/{workspaceId}/received", workspace.id())
                        .cookie(authCookie(destinationLeader)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        mockMvc.perform(get("/workspaces/{workspaceId}/received/{virtualId}", workspace.id(), receivedId)
                        .cookie(authCookie(destinationLeader)))
                .andExpect(status().isNotFound());
    }

    @Test
    void onlyTheCurrentSourceTeamLeaderCanPublishAndLegacyAclRoutesAreGone() throws Exception {
        User owner = createUser("Owner");
        User leader = createUser("Leader");
        User sourceMember = createUser("Source member");
        User destinationLeader = createUser("Destination leader");
        var workspace = configureWorkspace(owner);
        addMember(leader, workspace.id());
        addMember(sourceMember, workspace.id());
        addMember(destinationLeader, workspace.id());
        UUID sourceTeam = createTeam(owner, workspace.id(), "Source", memberId(workspace.id(), leader));
        UUID destinationTeam = createTeam(owner, workspace.id(), "Destination",
                memberId(workspace.id(), destinationLeader));
        UUID root = teamRoot(sourceTeam, owner, workspace.id());
        addTeamMember(leader, workspace.id(), sourceTeam, memberId(workspace.id(), sourceMember));
        UUID item = createItem(owner, workspace.id(), root, "Team item");

        mockMvc.perform(post("/workspaces/{workspaceId}/sharing/publications", workspace.id())
                        .cookie(authCookie(sourceMember)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "originalType", "ITEM", "originalId", item,
                                "destinationTeamId", destinationTeam))))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/everyone",
                                workspace.id(), root).cookie(authCookie(owner)))
                .andExpect(status().isGone());
        mockMvc.perform(get("/workspaces/{workspaceId}/sharing/collections/{collectionId}/origins",
                                workspace.id(), root).cookie(authCookie(owner)))
                .andExpect(status().isGone());
    }

    private UUID createTeam(User owner, UUID workspaceId, String name, UUID leaderMemberId) throws Exception {
        MvcResult result = mockMvc.perform(post("/workspaces/{workspaceId}/teams", workspaceId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", name, "leaderMemberId", leaderMemberId))))
                .andExpect(status().isCreated()).andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }

    private UUID teamRoot(UUID teamId, User owner, UUID workspaceId) throws Exception {
        MvcResult result = mockMvc.perform(get("/workspaces/{workspaceId}/teams/{teamId}", workspaceId, teamId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isOk()).andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString())
                .get("rootCollectionId").asText());
    }

    private void addTeamMember(User leader, UUID workspaceId, UUID teamId, UUID memberId) throws Exception {
        mockMvc.perform(post("/workspaces/{workspaceId}/teams/{teamId}/members", workspaceId, teamId)
                        .cookie(authCookie(leader)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("workspaceMemberId", memberId))))
                .andExpect(status().isNoContent());
    }

    private UUID createItem(User owner, UUID workspaceId, UUID collectionId, String title) throws Exception {
        MvcResult result = mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "type", "text", "title", title, "textContent", "content",
                                "collectionId", collectionId))))
                .andExpect(status().isCreated()).andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }

    private UUID memberId(UUID workspaceId, User user) {
        return workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, user.getId())
                .orElseThrow().getId();
    }

}
