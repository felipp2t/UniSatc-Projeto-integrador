package com.vaulty.api.workspace;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.entity.RolePermission;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.entity.Notification;
import com.vaulty.api.repository.NotificationRepository;
import com.vaulty.api.service.WorkspaceSharingService;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import com.vaulty.api.storage.ObjectStorage;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.boot.test.mock.mockito.MockBean;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WorkspaceSharingIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private ObjectMapper mapper;
    @MockBean private ObjectStorage storage;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private WorkspaceSharingService sharingService;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private JdbcTemplate jdbcTemplate;
    private UUID cleanupWorkspace;
    private UUID cleanupOwner;
    private UUID cleanupMember;
    private UUID cleanupParent;
    private UUID cleanupChild;
    private UUID cleanupGroupA;
    private UUID cleanupGroupB;

    @AfterEach
    void cleanConcurrentFixture() {
        if (cleanupWorkspace == null) return;
        jdbcTemplate.update("DELETE FROM notification WHERE recipient_id IN (?, ?)", cleanupOwner, cleanupMember);
        jdbcTemplate.update("DELETE FROM collection_access_grant WHERE collection_id IN (?, ?)", cleanupParent, cleanupChild);
        jdbcTemplate.update("DELETE FROM access_group_member WHERE group_id IN (?, ?)", cleanupGroupA, cleanupGroupB);
        jdbcTemplate.update("DELETE FROM access_group WHERE id IN (?, ?)", cleanupGroupA, cleanupGroupB);
        jdbcTemplate.update("DELETE FROM collection WHERE id IN (?, ?)", cleanupChild, cleanupParent);
        jdbcTemplate.update("UPDATE workspace SET owner_id='afd23ecc-4abb-4e2b-b985-3aaa8637a839' WHERE id=?", cleanupWorkspace);
        jdbcTemplate.update("DELETE FROM workspace_member WHERE user_id IN (?, ?)", cleanupOwner, cleanupMember);
        jdbcTemplate.update("""
                INSERT INTO workspace_member (id,user_id,workspace_id,role_id)
                SELECT gen_random_uuid(), 'afd23ecc-4abb-4e2b-b985-3aaa8637a839', ?, id
                FROM workspace_role WHERE workspace_id=? AND name='Owner'
                ON CONFLICT (workspace_id,user_id) DO NOTHING
                """, cleanupWorkspace, cleanupWorkspace);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentRevocationOfTwoGroupOriginsNotifiesOnlyAfterLastOriginIsRemoved() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        UUID workspace = configureWorkspace(owner).id();
        cleanupWorkspace = workspace;
        cleanupOwner = owner.getId();
        cleanupMember = member.getId();
        addMember(member, workspace);
        UUID parent = createFolder(owner, workspace, "Private", null);
        cleanupParent = parent;
        disableInheritance(owner, workspace, parent);
        revokeEveryone(owner, workspace, parent);
        UUID child = createFolder(owner, workspace, "Inherited private", parent);
        cleanupChild = child;
        UUID groupA = createGroup(owner, workspace, "A");
        UUID groupB = createGroup(owner, workspace, "B");
        cleanupGroupA = groupA;
        cleanupGroupB = groupB;
        UUID memberId = memberId(workspace, member);
        grantCollectionGroup(owner, workspace, child, groupA);
        grantCollectionGroup(owner, workspace, child, groupB);
        addToGroup(owner, workspace, groupA, memberId);
        addToGroup(owner, workspace, groupB, memberId);
        notificationRepository.deleteAll();
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(member))).andExpect(status().isOk());

        CountDownLatch firstApplied = new CountDownLatch(1);
        CountDownLatch allowFirstCommit = new CountDownLatch(1);
        CountDownLatch secondStarted = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        try {
            var revokeA = executor.submit(() -> transaction.execute(status -> {
                sharingService.revokeGroup(owner.getId(), workspace, child, groupA);
                firstApplied.countDown();
                await(allowFirstCommit);
                return null;
            }));
            assertTrue(firstApplied.await(5, TimeUnit.SECONDS));
            var revokeB = executor.submit(() -> transaction.execute(status -> {
                secondStarted.countDown();
                sharingService.revokeGroup(owner.getId(), workspace, child, groupB);
                return null;
            }));
            assertTrue(secondStarted.await(5, TimeUnit.SECONDS));
            awaitWorkspaceLockWait();
            allowFirstCommit.countDown();
            revokeA.get(10, TimeUnit.SECONDS);
            revokeB.get(10, TimeUnit.SECONDS);
        } finally {
            allowFirstCommit.countDown();
            executor.shutdownNow();
        }

        assertThatAccessChanged(member, 1);
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(member))).andExpect(status().isNotFound());
    }

    private void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) throw new AssertionError("Timed out waiting for concurrent start");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AssertionError(exception);
        }
    }

    private void awaitWorkspaceLockWait() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            Integer waiting = jdbcTemplate.queryForObject("""
                    SELECT count(*) FROM pg_stat_activity
                    WHERE datname = current_database() AND pid <> pg_backend_pid()
                      AND state = 'active' AND wait_event_type = 'Lock'
                    """, Integer.class);
            if (waiting != null && waiting > 0) return;
            Thread.sleep(10);
        }
        throw new AssertionError("Second ACL mutation did not block on the held workspace lock");
    }

    @Test
    void groupGrantAndRevocationNotifyOnlyMembersWhoseInheritedReadAccessChanges() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Granted member");
        User unrelated = createUser("Unrelated member");
        UUID workspace = configureWorkspace(owner).id();
        addMember(member, workspace);
        addMember(unrelated, workspace);
        UUID parent = createFolder(owner, workspace, "Private parent", null);
        disableInheritance(owner, workspace, parent);
        revokeEveryone(owner, workspace, parent);
        UUID child = createFolder(owner, workspace, "Inherited child", parent);
        UUID group = createGroup(owner, workspace, "Readers");
        UUID memberId = memberId(workspace, member);
        notificationRepository.deleteAll();

        grantCollectionGroup(owner, workspace, child, group);
        mockMvc.perform(put("/workspaces/{workspaceId}/groups/{groupId}/members/{memberId}",
                        workspace, group, memberId).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());

        assertThatAccessChanged(member, 1);
        assertThatAccessChanged(unrelated, 0);
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(member))).andExpect(status().isOk());

        mockMvc.perform(delete("/workspaces/{workspaceId}/groups/{groupId}/members/{memberId}",
                        workspace, group, memberId).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        assertThatAccessChanged(member, 2);
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(member))).andExpect(status().isNotFound());

        mockMvc.perform(put("/workspaces/{workspaceId}/groups/{groupId}/members/{memberId}",
                        workspace, group, memberId).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());

        mockMvc.perform(delete("/workspaces/{workspaceId}/sharing/collections/{collectionId}/groups/{groupId}",
                        workspace, child, group).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());

        assertThatAccessChanged(member, 4);
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(member))).andExpect(status().isNotFound());
    }

    @Test
    void revokingOneAccessOriginDoesNotNotifyWhenAnotherStillGrantsRead() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        UUID workspace = configureWorkspace(owner).id();
        addMember(member, workspace);
        UUID item = createRootItem(owner, workspace, "Shared item");
        UUID group = createGroup(owner, workspace, "Readers");
        UUID memberId = memberId(workspace, member);
        mockMvc.perform(put("/workspaces/{workspaceId}/groups/{groupId}/members/{memberId}",
                        workspace, group, memberId).cookie(authCookie(owner))).andExpect(status().isNoContent());
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/items/{itemId}/members/{memberId}",
                        workspace, item, memberId).cookie(authCookie(owner))).andExpect(status().isNoContent());
        notificationRepository.deleteAll();

        mockMvc.perform(delete("/workspaces/{workspaceId}/sharing/items/{itemId}/members/{memberId}",
                        workspace, item, memberId).cookie(authCookie(owner))).andExpect(status().isNoContent());

        assertThatAccessChanged(member, 0);
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspace, item)
                        .cookie(authCookie(member))).andExpect(status().isOk());
    }

    private void assertThatAccessChanged(User user, int expectedCount) {
        assertEquals(expectedCount, notificationRepository.findAll().stream()
                .filter(notification -> notification.getRecipient().getId().equals(user.getId()))
                .filter(this::isAccessChanged).count());
    }

    private boolean isAccessChanged(Notification notification) {
        return "ACCESS_CHANGED".equals(notification.getMetadata().get("event"));
    }

    @Test
    void groupGrantsAndMembershipChangesApplyImmediatelyAndRequireSharingPermission() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        UUID workspace = configureWorkspace(owner).id();
        addMember(member, workspace);
        UUID folder = createFolder(owner, workspace, "Parent", null);
        UUID child = createFolder(owner, workspace, "Restricted", folder);
        disableInheritance(owner, workspace, child);
        revokeEveryone(owner, workspace, child);
        UUID group = createGroup(owner, workspace, "Readers");
        UUID memberId = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace, member.getId())
                .orElseThrow().getId();
        String share = "/workspaces/%s/sharing/collections/%s/groups/%s".formatted(workspace, child, group);

        mockMvc.perform(put(share).cookie(authCookie(owner))).andExpect(status().isNoContent());
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(member))).andExpect(status().isNotFound());
        grant(member, workspace, "collection", "create");
        mockMvc.perform(put(share).cookie(authCookie(member))).andExpect(status().isForbidden());
        mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspace).cookie(authCookie(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("name", "Hidden child", "parentId", child))))
                .andExpect(status().isNotFound());
        grant(member, workspace, "item", "create");
        var hiddenItem = mapper.createObjectNode().put("type", "text").put("title", "Hidden item")
                .put("textContent", "body").put("collectionId", child.toString());
        mockMvc.perform(post("/workspaces/{workspaceId}/items", workspace).cookie(authCookie(member))
                        .contentType(MediaType.APPLICATION_JSON).content(hiddenItem.toString()))
                .andExpect(status().isNotFound());
        grant(member, workspace, "sharing", "manage");
        mockMvc.perform(put(share).cookie(authCookie(member))).andExpect(status().isNotFound());
        mockMvc.perform(put("/workspaces/{workspaceId}/groups/{groupId}/members/{memberId}", workspace, group, memberId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(member))).andExpect(status().isOk());
        mockMvc.perform(delete("/workspaces/{workspaceId}/groups/{groupId}/members/{memberId}", workspace, group, memberId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(member))).andExpect(status().isNotFound());

        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/groups/{groupId}",
                        workspace, UUID.randomUUID(), group).cookie(authCookie(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void directItemGrantDoesNotExposeItsFolderOrOtherItemsAndOriginsKeepOtherSources() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        User readmitted = createUser("Readmitted");
        UUID workspace = configureWorkspace(owner).id();
        addMember(member, workspace);
        addMember(readmitted, workspace);
        UUID parent = createFolder(owner, workspace, "Parent", null);
        UUID restricted = createFolder(owner, workspace, "Private", parent);
        disableInheritance(owner, workspace, restricted);
        revokeEveryone(owner, workspace, restricted);
        mockMvc.perform(get("/workspaces/{workspaceId}/collections", workspace).cookie(authCookie(member))
                        .param("parentId", parent.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));
        UUID target = createItem(owner, workspace, "Target", restricted);
        UUID neighbor = createItem(owner, workspace, "Neighbor", restricted);
        UUID oldMembership = memberId(workspace, readmitted);
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/items/{itemId}/members/{memberId}",
                        workspace, target, oldMembership).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        jdbcTemplate.update("DELETE FROM workspace_member WHERE id = ?", oldMembership);
        addMember(readmitted, workspace);
        org.assertj.core.api.Assertions.assertThat(memberId(workspace, readmitted)).isNotEqualTo(oldMembership);
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspace, target)
                        .cookie(authCookie(readmitted))).andExpect(status().isNotFound());
        byte[] fileBytes = "private attachment".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        when(storage.get(anyString())).thenReturn(fileBytes);
        JsonNode file = mapper.readTree(mockMvc.perform(multipart("/workspaces/{workspaceId}/items/attachments", workspace)
                        .file(new MockMultipartFile("file", "private.txt", "text/plain", fileBytes))
                        .param("title", "Private file").param("collectionId", restricted.toString())
                        .cookie(authCookie(owner)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        UUID fileItem = UUID.fromString(file.get("itemId").asText());
        UUID memberId = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace, member.getId())
                .orElseThrow().getId();
        UUID group = createGroup(owner, workspace, "Readers");
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/items/{itemId}/members/{memberId}", workspace, target, memberId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspace, target)
                        .cookie(authCookie(member))).andExpect(status().isOk());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspace, neighbor)
                        .cookie(authCookie(member))).andExpect(status().isNotFound());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/attachment", workspace, fileItem)
                        .cookie(authCookie(member))).andExpect(status().isNotFound());
        mockMvc.perform(get(path(workspace, restricted)).cookie(authCookie(member))).andExpect(status().isNotFound());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspace).cookie(authCookie(member))
                        .param("q", "Target"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspace).cookie(authCookie(member))
                        .param("q", "Neighbor"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(0));

        // A second independent origin remains after the direct exception is revoked.
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/groups/{groupId}", workspace, restricted, group)
                        .cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/items/{itemId}/members/{memberId}",
                        workspace, fileItem, memberId).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/attachment", workspace, fileItem)
                        .cookie(authCookie(member))).andExpect(status().isOk()).andExpect(content().bytes(fileBytes));
        mockMvc.perform(put("/workspaces/{workspaceId}/groups/{groupId}/members/{memberId}", workspace, group, memberId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/workspaces/{workspaceId}/sharing/items/{itemId}/members/{memberId}", workspace, target, memberId)
                        .cookie(authCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/workspaces/{workspaceId}/sharing/items/{itemId}/origins", workspace, target)
                        .cookie(authCookie(member)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0]").value("group:" + group));
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspace, target)
                        .cookie(authCookie(member))).andExpect(status().isOk());
    }

    @Test
    void breakingInheritanceCopiesPublicAndGroupGrantsAndReactivationKeepsLocalGrant() throws Exception {
        User owner = createUser("Owner");
        User inParentGroup = createUser("Parent group");
        User localGroupMember = createUser("Local group");
        User everyone = createUser("Everyone");
        User addedAfterBreak = createUser("Added after break");
        UUID workspace = configureWorkspace(owner).id();
        addMember(inParentGroup, workspace);
        addMember(localGroupMember, workspace);
        addMember(everyone, workspace);
        UUID parent = createFolder(owner, workspace, "Parent", null);
        UUID child = createFolder(owner, workspace, "Child", parent);
        UUID local = createGroup(owner, workspace, "Local");
        UUID inherited = createGroup(owner, workspace, "Inherited");
        UUID parentMemberId = memberId(workspace, inParentGroup);
        UUID localMemberId = memberId(workspace, localGroupMember);
        String sharing = "/workspaces/%s/sharing".formatted(workspace);

        // Grant a parent group and everyone; local access is a separate origin.
        grantCollectionEveryone(owner, workspace, parent);
        grantCollectionGroup(owner, workspace, parent, inherited);
        addToGroup(owner, workspace, inherited, parentMemberId);
        grantCollectionGroup(owner, workspace, child, local);
        addToGroup(owner, workspace, local, localMemberId);
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/inheritance", workspace, child)
                        .cookie(authCookie(owner)).param("enabled", "false"))
                .andExpect(status().isNoContent());
        addMember(addedAfterBreak, workspace);
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(addedAfterBreak))).andExpect(status().isOk());
        mockMvc.perform(delete("/workspaces/{workspaceId}/sharing/collections/{collectionId}/everyone", workspace, child)
                        .cookie(authCookie(owner))).andExpect(status().isNoContent());
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(everyone))).andExpect(status().isNotFound());
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(addedAfterBreak))).andExpect(status().isNotFound());
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(inParentGroup))).andExpect(status().isOk());
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(localGroupMember))).andExpect(status().isOk());

        removeFromGroup(owner, workspace, inherited, parentMemberId);
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(inParentGroup))).andExpect(status().isNotFound());
        addToGroup(owner, workspace, inherited, parentMemberId);
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(inParentGroup))).andExpect(status().isOk());

        // Re-enabling inheritance adds the parent's current grants while preserving the local group.
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/inheritance", workspace, child)
                        .cookie(authCookie(owner)).param("enabled", "true"))
                .andExpect(status().isNoContent());
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(everyone))).andExpect(status().isOk());
        mockMvc.perform(delete("/workspaces/{workspaceId}/sharing/collections/{collectionId}/groups/{groupId}", workspace, child, inherited)
                        .cookie(authCookie(owner))).andExpect(status().isNoContent());
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(inParentGroup))).andExpect(status().isOk());
        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(localGroupMember))).andExpect(status().isOk());
    }

    @Test
    void onlyOwnerCanDelegateSharingAndBuiltInRolesCannotBeChanged() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        UUID workspace = configureWorkspace(owner).id();
        addMember(member, workspace);
        WorkspaceRole custom = new WorkspaceRole();
        custom.setWorkspace(workspaceRepository.findById(workspace).orElseThrow());
        custom.setName("Content editor");
        custom = workspaceRoleRepository.saveAndFlush(custom);
        grant(member, workspace, "collection", "create");
        var membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace, member.getId()).orElseThrow();
        membership.setRole(custom);
        workspaceMemberRepository.saveAndFlush(membership);
        UUID customRole = custom.getId();

        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/roles/{roleId}/manager", workspace, customRole)
                        .cookie(authCookie(member)).param("enabled", "true"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/roles/{roleId}/manager", workspace, customRole)
                        .cookie(authCookie(owner)).param("enabled", "true"))
                .andExpect(status().isNoContent());
        UUID folder = createFolder(owner, workspace, "Folder", null);
        UUID group = createGroup(owner, workspace, "Group");
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/groups/{groupId}",
                        workspace, folder, group).cookie(authCookie(member)))
                .andExpect(status().isNoContent());
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/roles/{roleId}/manager", workspace,
                        workspaceRoleRepository.findByWorkspaceIdAndName(workspace, "Owner").orElseThrow().getId())
                        .cookie(authCookie(owner)).param("enabled", "false"))
                .andExpect(status().isConflict());
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/roles/{roleId}/manager", workspace,
                        workspaceRoleRepository.findByWorkspaceIdAndName(workspace, "Member").orElseThrow().getId())
                        .cookie(authCookie(owner)).param("enabled", "true"))
                .andExpect(status().isConflict());
    }

    @Test
    void deletingGroupWithFolderGrantCannotSilentlyDeleteThatAccessOrigin() throws Exception {
        User owner = createUser("Owner");
        UUID workspace = configureWorkspace(owner).id();
        UUID folder = createFolder(owner, workspace, "Folder", null);
        UUID group = createGroup(owner, workspace, "Readers");
        grantCollectionGroup(owner, workspace, folder, group);

        mockMvc.perform(delete("/workspaces/{workspaceId}/groups/{groupId}", workspace, group)
                        .cookie(authCookie(owner)))
                .andExpect(status().isConflict());
        org.assertj.core.api.Assertions.assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM collection_access_grant WHERE collection_id = ? AND group_id = ?",
                Integer.class, folder, group)).isEqualTo(1);
    }

    @Test
    void revokedEveryoneGrantRestrictsRootFolderItemsSearchAndAttachment() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        UUID workspace = configureWorkspace(owner).id();
        addMember(member, workspace);
        UUID root = createFolder(owner, workspace, "Root private after revoke", null);
        disableInheritance(owner, workspace, root);
        UUID item = createItem(owner, workspace, "Root search target", root);
        byte[] bytes = "root attachment".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        when(storage.get(anyString())).thenReturn(bytes);
        JsonNode file = mapper.readTree(mockMvc.perform(multipart("/workspaces/{workspaceId}/items/attachments", workspace)
                        .file(new MockMultipartFile("file", "root.txt", "text/plain", bytes))
                        .param("title", "Root file").param("collectionId", root.toString()).cookie(authCookie(owner)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        UUID fileItem = UUID.fromString(file.get("itemId").asText());
        grantCollectionEveryone(owner, workspace, root);
        mockMvc.perform(delete("/workspaces/{workspaceId}/sharing/collections/{collectionId}/everyone", workspace, root)
                        .cookie(authCookie(owner))).andExpect(status().isNoContent());

        int pathStatus = mockMvc.perform(get(path(workspace, root)).cookie(authCookie(member)))
                .andReturn().getResponse().getStatus();
        int itemStatus = mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}", workspace, item)
                .cookie(authCookie(member))).andReturn().getResponse().getStatus();
        int attachmentStatus = mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/attachment", workspace, fileItem)
                .cookie(authCookie(member))).andReturn().getResponse().getStatus();
        JsonNode folderPage = mapper.readTree(mockMvc.perform(get("/workspaces/{workspaceId}/collections", workspace)
                        .cookie(authCookie(member)))
                .andReturn().getResponse().getContentAsString());
        JsonNode itemPage = mapper.readTree(mockMvc.perform(get("/workspaces/{workspaceId}/items", workspace)
                        .cookie(authCookie(member)).param("collectionId", root.toString()))
                .andReturn().getResponse().getContentAsString());
        JsonNode searchPage = mapper.readTree(mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspace)
                        .cookie(authCookie(member)).param("q", "Root search target"))
                .andReturn().getResponse().getContentAsString());

        assertAll("removing everyone from a root folder removes implicit access",
                () -> assertEquals(404, pathStatus),
                () -> assertEquals(404, itemStatus),
                () -> assertEquals(404, attachmentStatus),
                () -> assertFalse(folderPage.path("items").toString().contains(root.toString())),
                () -> assertEquals(0, itemPage.path("totalItems").asInt()),
                () -> assertEquals(0, searchPage.path("totalItems").asInt()));
    }

    @Test
    void breakingInheritanceFromRootPreservesImplicitPublicGrantForExistingAndNewMembers() throws Exception {
        User owner = createUser("Owner");
        User currentMember = createUser("Current member");
        User newMember = createUser("New member");
        User localMember = createUser("Local group member");
        UUID workspace = configureWorkspace(owner).id();
        addMember(currentMember, workspace);
        addMember(localMember, workspace);
        UUID parent = createFolder(owner, workspace, "Root parent", null);
        UUID child = createFolder(owner, workspace, "Child", parent);
        UUID localGroup = createGroup(owner, workspace, "Local group");
        addToGroup(owner, workspace, localGroup, memberId(workspace, localMember));
        grantCollectionGroup(owner, workspace, child, localGroup);

        mockMvc.perform(get(path(workspace, child)).cookie(authCookie(currentMember))).andExpect(status().isOk());
        disableInheritance(owner, workspace, child);
        addMember(newMember, workspace);
        int existingMemberStatus = mockMvc.perform(get(path(workspace, child)).cookie(authCookie(currentMember)))
                .andReturn().getResponse().getStatus();
        int newMemberStatus = mockMvc.perform(get(path(workspace, child)).cookie(authCookie(newMember)))
                .andReturn().getResponse().getStatus();
        mockMvc.perform(delete("/workspaces/{workspaceId}/sharing/collections/{collectionId}/everyone", workspace, child)
                        .cookie(authCookie(owner))).andExpect(status().isNoContent());
        int existingAfterRestrict = mockMvc.perform(get(path(workspace, child)).cookie(authCookie(currentMember)))
                .andReturn().getResponse().getStatus();
        int newAfterRestrict = mockMvc.perform(get(path(workspace, child)).cookie(authCookie(newMember)))
                .andReturn().getResponse().getStatus();
        int localMemberAfterRestrict = mockMvc.perform(get(path(workspace, child)).cookie(authCookie(localMember)))
                .andReturn().getResponse().getStatus();
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/inheritance", workspace, child)
                        .cookie(authCookie(owner)).param("enabled", "true"))
                .andExpect(status().isNoContent());
        int existingAfterReenable = mockMvc.perform(get(path(workspace, child)).cookie(authCookie(currentMember)))
                .andReturn().getResponse().getStatus();
        int newAfterReenable = mockMvc.perform(get(path(workspace, child)).cookie(authCookie(newMember)))
                .andReturn().getResponse().getStatus();
        int localAfterReenable = mockMvc.perform(get(path(workspace, child)).cookie(authCookie(localMember)))
                .andReturn().getResponse().getStatus();

        assertAll("subfolder reactivation restores current parent access and preserves local grants",
                () -> assertEquals(200, existingMemberStatus),
                () -> assertEquals(200, newMemberStatus),
                () -> assertEquals(404, existingAfterRestrict),
                () -> assertEquals(404, newAfterRestrict),
                () -> assertEquals(200, localMemberAfterRestrict),
                () -> assertEquals(200, existingAfterReenable),
                () -> assertEquals(200, newAfterReenable),
                () -> assertEquals(200, localAfterReenable));
    }

    @Test
    void originsReportDirectMemberAndRootItemSources() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        UUID workspace = configureWorkspace(owner).id();
        addMember(member, workspace);
        UUID privateParent = createFolder(owner, workspace, "Parent", null);
        UUID privateFolder = createFolder(owner, workspace, "Private", privateParent);
        disableInheritance(owner, workspace, privateFolder);
        revokeEveryone(owner, workspace, privateFolder);
        UUID directItem = createItem(owner, workspace, "Direct only", privateFolder);
        UUID rootItem = createRootItem(owner, workspace, "Root item");
        UUID memberId = memberId(workspace, member);
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/items/{itemId}/members/{memberId}",
                        workspace, directItem, memberId).cookie(authCookie(owner)))
                .andExpect(status().isNoContent());

        JsonNode directOrigins = mapper.readTree(mockMvc.perform(get(
                                "/workspaces/{workspaceId}/sharing/items/{itemId}/origins", workspace, directItem)
                        .cookie(authCookie(member)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode rootOrigins = mapper.readTree(mockMvc.perform(get(
                                "/workspaces/{workspaceId}/sharing/items/{itemId}/origins", workspace, rootItem)
                        .cookie(authCookie(member)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        assertAll("source lists identify how each item is accessible",
                () -> assertEquals(1, directOrigins.size()),
                () -> assertEquals("member:" + memberId, directOrigins.path(0).asText()),
                () -> assertEquals(1, rootOrigins.size()),
                () -> assertEquals("public:workspace-root", rootOrigins.path(0).asText()));
    }

    @Test
    void breakingRootInheritanceCopiesItsPublicAudienceAndRevokingItMakesFolderPrivate() throws Exception {
        User owner = createUser("Owner");
        User existing = createUser("Existing member");
        User addedAfterBreak = createUser("New member");
        UUID workspace = configureWorkspace(owner).id();
        addMember(existing, workspace);
        UUID root = createFolder(owner, workspace, "Root folder", null);

        mockMvc.perform(get(path(workspace, root)).cookie(authCookie(existing))).andExpect(status().isOk());
        disableInheritance(owner, workspace, root);
        addMember(addedAfterBreak, workspace);
        int existingAfterBreak = mockMvc.perform(get(path(workspace, root)).cookie(authCookie(existing)))
                .andReturn().getResponse().getStatus();
        int newAfterBreak = mockMvc.perform(get(path(workspace, root)).cookie(authCookie(addedAfterBreak)))
                .andReturn().getResponse().getStatus();
        JsonNode copiedOrigins = mapper.readTree(mockMvc.perform(get(
                                "/workspaces/{workspaceId}/sharing/collections/{collectionId}/origins", workspace, root)
                        .cookie(authCookie(existing)))
                .andReturn().getResponse().getContentAsString());

        revokeEveryone(owner, workspace, root);
        int existingAfterRevoke = mockMvc.perform(get(path(workspace, root)).cookie(authCookie(existing)))
                .andReturn().getResponse().getStatus();
        int newAfterRevoke = mockMvc.perform(get(path(workspace, root)).cookie(authCookie(addedAfterBreak)))
                .andReturn().getResponse().getStatus();
        boolean inheritanceRemainsDisabled = !jdbcTemplate.queryForObject(
                "SELECT inherit_access FROM collection WHERE id = ?", Boolean.class, root);

        assertAll("breaking a root folder copies public access locally, which can later be revoked",
                () -> assertEquals(200, existingAfterBreak),
                () -> assertEquals(200, newAfterBreak),
                () -> assertTrue(copiedOrigins.toString().contains("public:collection:" + root)),
                () -> assertEquals(404, existingAfterRevoke),
                () -> assertEquals(404, newAfterRevoke),
                () -> assertTrue(inheritanceRemainsDisabled));
    }

    @Test
    void revokingExplicitEveryoneFromInheritingRootKeepsWorkspaceAudienceAndInheritance() throws Exception {
        User owner = createUser("Owner");
        User member = createUser("Member");
        User newMember = createUser("New member");
        UUID workspace = configureWorkspace(owner).id();
        addMember(member, workspace);
        UUID root = createFolder(owner, workspace, "Root folder", null);
        grantCollectionEveryone(owner, workspace, root);

        JsonNode before = mapper.readTree(mockMvc.perform(get(
                                "/workspaces/{workspaceId}/sharing/collections/{collectionId}/origins", workspace, root)
                        .cookie(authCookie(member)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        disableInheritance(owner, workspace, root);
        addMember(newMember, workspace);
        int memberAfterBreak = mockMvc.perform(get(path(workspace, root)).cookie(authCookie(member)))
                .andReturn().getResponse().getStatus();
        int newMemberAfterBreak = mockMvc.perform(get(path(workspace, root)).cookie(authCookie(newMember)))
                .andReturn().getResponse().getStatus();
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/inheritance", workspace, root)
                        .cookie(authCookie(owner)).param("enabled", "true"))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/workspaces/{workspaceId}/sharing/collections/{collectionId}/everyone", workspace, root)
                        .cookie(authCookie(owner))).andExpect(status().isNoContent());
        JsonNode after = mapper.readTree(mockMvc.perform(get(
                                "/workspaces/{workspaceId}/sharing/collections/{collectionId}/origins", workspace, root)
                        .cookie(authCookie(member)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        int readStatus = mockMvc.perform(get(path(workspace, root)).cookie(authCookie(member)))
                .andReturn().getResponse().getStatus();
        int newMemberReadStatus = mockMvc.perform(get(path(workspace, root)).cookie(authCookie(newMember)))
                .andReturn().getResponse().getStatus();
        boolean inheritanceRemainsEnabled = jdbcTemplate.queryForObject(
                "SELECT inherit_access FROM collection WHERE id = ?", Boolean.class, root);

        assertAll("revoking one root origin does not disable inherited workspace access",
                () -> assertEquals(2, before.size()),
                () -> assertTrue(before.toString().contains("public:workspace-root")),
                () -> assertTrue(before.toString().contains("public:collection:" + root)),
                () -> assertEquals(200, memberAfterBreak),
                () -> assertEquals(200, newMemberAfterBreak),
                () -> assertEquals(1, after.size()),
                () -> assertTrue(after.toString().contains("public:workspace-root")),
                () -> assertEquals(200, readStatus),
                () -> assertEquals(200, newMemberReadStatus),
                () -> assertTrue(inheritanceRemainsEnabled));
    }

    private UUID createFolder(User owner, UUID workspace, String name, UUID parent) throws Exception {
        var request = mapper.createObjectNode().put("name", name);
        if (parent != null) request.put("parentId", parent.toString());
        JsonNode response = mapper.readTree(mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspace)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON).content(request.toString()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        return UUID.fromString(response.get("id").asText());
    }

    private UUID createItem(User owner, UUID workspace, String title, UUID folder) throws Exception {
        var body = mapper.createObjectNode().put("type", "text").put("title", title).put("textContent", "Body");
        body.put("collectionId", folder.toString());
        JsonNode response = mapper.readTree(mockMvc.perform(post("/workspaces/{workspaceId}/items", workspace)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON).content(body.toString()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        return UUID.fromString(response.get("id").asText());
    }

    private UUID createRootItem(User owner, UUID workspace, String title) throws Exception {
        var body = mapper.createObjectNode().put("type", "text").put("title", title).put("textContent", "Body");
        JsonNode response = mapper.readTree(mockMvc.perform(post("/workspaces/{workspaceId}/items", workspace)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON).content(body.toString()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        return UUID.fromString(response.get("id").asText());
    }

    private UUID createGroup(User owner, UUID workspace, String name) throws Exception {
        JsonNode response = mapper.readTree(mockMvc.perform(post("/workspaces/{workspaceId}/groups", workspace)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("name", name))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        return UUID.fromString(response.get("id").asText());
    }

    private UUID memberId(UUID workspace, User member) {
        return workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace, member.getId()).orElseThrow().getId();
    }

    private void addToGroup(User owner, UUID workspace, UUID group, UUID member) throws Exception {
        mockMvc.perform(put("/workspaces/{workspaceId}/groups/{groupId}/members/{memberId}", workspace, group, member)
                        .cookie(authCookie(owner))).andExpect(status().isNoContent());
    }

    private void removeFromGroup(User owner, UUID workspace, UUID group, UUID member) throws Exception {
        mockMvc.perform(delete("/workspaces/{workspaceId}/groups/{groupId}/members/{memberId}", workspace, group, member)
                        .cookie(authCookie(owner))).andExpect(status().isNoContent());
    }

    private void grantCollectionGroup(User owner, UUID workspace, UUID folder, UUID group) throws Exception {
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/groups/{groupId}",
                        workspace, folder, group).cookie(authCookie(owner))).andExpect(status().isNoContent());
    }

    private void grantCollectionEveryone(User owner, UUID workspace, UUID folder) throws Exception {
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/everyone", workspace, folder)
                        .cookie(authCookie(owner))).andExpect(status().isNoContent());
    }

    private void revokeEveryone(User owner, UUID workspace, UUID folder) throws Exception {
        mockMvc.perform(delete("/workspaces/{workspaceId}/sharing/collections/{collectionId}/everyone", workspace, folder)
                        .cookie(authCookie(owner))).andExpect(status().isNoContent());
    }

    private void disableInheritance(User owner, UUID workspace, UUID folder) throws Exception {
        mockMvc.perform(put("/workspaces/{workspaceId}/sharing/collections/{collectionId}/inheritance", workspace, folder)
                        .cookie(authCookie(owner)).param("enabled", "false"))
                .andExpect(status().isNoContent());
    }

    private void grant(User user, UUID workspace, String resource, String action) {
        WorkspaceRole role = workspaceRoleRepository.findByWorkspaceIdAndName(workspace, "Member").orElseThrow();
        RolePermission permission = new RolePermission();
        permission.setRole(role);
        permission.setResource(resource);
        permission.setAction(action);
        rolePermissionRepository.saveAndFlush(permission);
        var membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace, user.getId()).orElseThrow();
        membership.setRole(role);
        workspaceMemberRepository.saveAndFlush(membership);
    }

    private String path(UUID workspace, UUID folder) {
        return "/workspaces/%s/collections/%s/path".formatted(workspace, folder);
    }
}
