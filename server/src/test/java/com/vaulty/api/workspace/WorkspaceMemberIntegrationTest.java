package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.dto.workspace.UpdateWorkspaceRequest;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.RolePermission;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.entity.AccessGroup;
import com.vaulty.api.entity.AccessGroupMember;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.AccessGroupRepository;
import com.vaulty.api.repository.AccessGroupMemberRepository;
import com.vaulty.api.repository.RefreshTokenRepository;
import com.vaulty.api.repository.NotificationRepository;
import com.vaulty.api.repository.WorkspaceItemRepository;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.HttpHeaders;
import com.vaulty.api.service.WorkspaceMemberService;
import com.vaulty.api.service.WorkspaceService;
import com.vaulty.api.service.NotificationService;

class WorkspaceMemberIntegrationTest extends WorkspaceIntegrationSupport {

    @Autowired private EntityManager entityManager;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AccessGroupRepository groupRepository;
    @Autowired private AccessGroupMemberRepository groupMemberRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private WorkspaceItemRepository itemRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private WorkspaceMemberService workspaceMemberService;
    @Autowired private WorkspaceService workspaceService;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private NotificationService notificationService;
    private UUID cleanupWorkspace;
    private UUID cleanupOwner;
    private UUID cleanupMember;
    private UUID cleanupThirdMember;
    private UUID cleanupCollection;

    @AfterEach
    void cleanNonTransactionalFixtures() {
        if (cleanupWorkspace == null) return;
        jdbcTemplate.update("DELETE FROM notification WHERE recipient_id IN (?, ?, ?)", cleanupOwner,
                cleanupMember, cleanupThirdMember == null ? cleanupMember : cleanupThirdMember);
        if (cleanupCollection != null) jdbcTemplate.update("DELETE FROM collection WHERE id=?", cleanupCollection);
        jdbcTemplate.update("UPDATE workspace SET owner_id='afd23ecc-4abb-4e2b-b985-3aaa8637a839' WHERE id=?", cleanupWorkspace);
        jdbcTemplate.update("DELETE FROM workspace_member WHERE user_id IN (?, ?, ?)", cleanupOwner,
                cleanupMember, cleanupThirdMember == null ? cleanupMember : cleanupThirdMember);
        jdbcTemplate.update("""
                INSERT INTO workspace_member (id,user_id,workspace_id,role_id)
                SELECT gen_random_uuid(), 'afd23ecc-4abb-4e2b-b985-3aaa8637a839', ?, id
                FROM workspace_role WHERE workspace_id=? AND name='Owner'
                ON CONFLICT (workspace_id,user_id) DO NOTHING
                """, cleanupWorkspace, cleanupWorkspace);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void accountOnlyLoginCanReadOwnNotificationsButCannotRestoreWorkspaceAuthority() throws Exception {
        User owner = createUser("Proprietário");
        User target = createUser("Membro removido");
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(target, workspaceId);
        var targetMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, target.getId())
                .orElseThrow();
        var priorLogin = mockMvc.perform(post("/auth/login").with(uniqueRemoteAddress()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + target.getEmail() + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk()).andReturn();
        var priorAccess = priorLogin.getResponse().getCookie("accessToken");
        var priorRefresh = priorLogin.getResponse().getCookie("refreshToken");

        mockMvc.perform(delete("/workspaces/{workspaceId}/members/{membershipId}", workspaceId,
                        targetMembership.getId()).cookie(authCookie(owner))
                        .param("confirmMemberId", targetMembership.getId().toString()))
                .andExpect(status().isNoContent());

        var notification = notificationRepository.findAll().stream()
                .filter(candidate -> candidate.getRecipient().getId().equals(target.getId()))
                .filter(candidate -> "ACCESS_CHANGED".equals(candidate.getMetadata().get("event")))
                .findFirst().orElseThrow();
        mockMvc.perform(get("/notifications?page=0&size=20").cookie(priorAccess))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/auth/refresh").cookie(priorRefresh)).andExpect(status().isUnauthorized());
        var accountLogin = mockMvc.perform(post("/auth/login").with(uniqueRemoteAddress()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + target.getEmail() + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk()).andReturn();
        var accountAccess = accountLogin.getResponse().getCookie("accessToken");
        var clearedRefresh = accountLogin.getResponse().getCookie("refreshToken");
        assertThat(clearedRefresh).isNotNull();
        assertThat(clearedRefresh.getValue()).isEmpty();
        assertThat(clearedRefresh.getMaxAge()).isZero();
        assertThat(refreshTokenRepository.findAll()).noneMatch(token -> token.getUser().getId().equals(target.getId()));
        assertThat(jwtService.validateAccessToken(accountAccess.getValue()).orElseThrow().accountOnly()).isTrue();

        mockMvc.perform(get("/notifications?page=0&size=20").cookie(accountAccess))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.notifications[0].id").value(notification.getId().toString()))
                .andExpect(jsonPath("$.notifications[0].metadata.event").value("ACCESS_CHANGED"));
        mockMvc.perform(patch("/notifications/{id}/read", notification.getId()).cookie(accountAccess))
                .andExpect(status().isNoContent());
        notificationService.profileUpdated(owner.getId());
        var ownerNotification = notificationRepository.findAll().stream()
                .filter(candidate -> candidate.getRecipient().getId().equals(owner.getId()))
                .findFirst().orElseThrow();
        mockMvc.perform(patch("/notifications/{id}/read", ownerNotification.getId()).cookie(accountAccess))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/me").cookie(accountAccess)).andExpect(status().isOk());
        mockMvc.perform(patch("/me/password").cookie(accountAccess).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"password123\",\"newPassword\":\"changed-password\","
                                + "\"confirmPassword\":\"changed-password\"}"))
                .andExpect(status().isNoContent());

        UUID itemId = UUID.randomUUID();
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId).cookie(accountAccess))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/search", workspaceId).param("q", "secret")
                        .cookie(accountAccess)).andExpect(status().isForbidden());
        mockMvc.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, itemId)
                        .cookie(accountAccess)).andExpect(status().isForbidden());
        mockMvc.perform(get("/workspaces/{workspaceId}/groups", workspaceId).cookie(accountAccess))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/workspaces/{workspaceId}/sharing/items/{itemId}/origins", workspaceId, itemId)
                        .cookie(accountAccess)).andExpect(status().isForbidden());

        addMember(target, workspaceId);
        workspaceMemberRepository.flush();
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId).cookie(priorAccess))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId).cookie(accountAccess))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/auth/refresh").cookie(priorRefresh)).andExpect(status().isUnauthorized());

        var workspaceLogin = mockMvc.perform(post("/auth/login").with(uniqueRemoteAddress()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + target.getEmail() + "\",\"password\":\"changed-password\"}"))
                .andExpect(status().isOk()).andReturn();
        var workspaceAccess = workspaceLogin.getResponse().getCookie("accessToken");
        var workspaceRefresh = workspaceLogin.getResponse().getCookie("refreshToken");
        assertThat(workspaceRefresh).isNotNull();
        assertThat(workspaceRefresh.getValue()).isNotEmpty();
        assertThat(jwtService.validateAccessToken(workspaceAccess.getValue()).orElseThrow().accountOnly()).isFalse();
        mockMvc.perform(get("/workspaces/{workspaceId}/items", workspaceId).cookie(workspaceAccess))
                .andExpect(status().isOk());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void accountOnlySessionCanLogoutWithoutRefreshCookieAndExpiresBothCookies() throws Exception {
        User owner = createUser("Proprietário");
        User removed = createUser("Removido");
        UUID workspaceId = configureWorkspace(owner).id();
        cleanupWorkspace = workspaceId;
        cleanupOwner = owner.getId();
        cleanupMember = removed.getId();
        addMember(removed, workspaceId);
        var membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, removed.getId())
                .orElseThrow();
        mockMvc.perform(delete("/workspaces/{workspaceId}/members/{membershipId}", workspaceId, membership.getId())
                        .cookie(authCookie(owner)).param("confirmMemberId", membership.getId().toString()))
                .andExpect(status().isNoContent());

        var login = mockMvc.perform(post("/auth/login").with(uniqueRemoteAddress()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + removed.getEmail() + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk()).andReturn();
        var access = login.getResponse().getCookie("accessToken");
        var refresh = login.getResponse().getCookie("refreshToken");
        assertThat(access).isNotNull();
        assertThat(refresh).isNotNull();
        assertThat(refresh.getValue()).isEmpty();

        var logout = mockMvc.perform(post("/auth/logout").cookie(access))
                .andExpect(status().isNoContent()).andReturn().getResponse();
        assertThat(logout.getHeaders(HttpHeaders.SET_COOKIE)).hasSize(2)
                .allSatisfy(cookie -> assertThat(cookie).contains("Max-Age=0"));
        assertThat(logout.getHeaders(HttpHeaders.SET_COOKIE)).anySatisfy(cookie ->
                assertThat(cookie).contains("accessToken=").contains("Max-Age=0"));
        assertThat(logout.getHeaders(HttpHeaders.SET_COOKIE)).anySatisfy(cookie ->
                assertThat(cookie).contains("refreshToken=").contains("Max-Age=0"));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void removingCanonicalOwnerNotifiesSuccessorWhoGainsPrivateFolderAccess() throws Exception {
        User owner = createUser("Dono removido");
        User successor = createUser("Novo dono");
        User unchanged = createUser("Membro sem mudança");
        UUID workspaceId = configureWorkspace(owner).id();
        cleanupWorkspace = workspaceId;
        cleanupOwner = owner.getId();
        cleanupMember = successor.getId();
        cleanupThirdMember = unchanged.getId();
        addMember(successor, workspaceId);
        addMember(unchanged, workspaceId);
        var restricted = mockMvc.perform(post("/workspaces/{workspaceId}/collections", workspaceId)
                        .cookie(authCookie(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Privada\"}"))
                .andExpect(status().isCreated()).andReturn();
        UUID collectionId = UUID.fromString(objectMapper.readTree(restricted.getResponse().getContentAsString())
                .get("id").asText());
        cleanupCollection = collectionId;
        jdbcTemplate.update("UPDATE collection SET inherit_access=FALSE WHERE id=?", collectionId);
        jdbcTemplate.update("DELETE FROM collection_public_grant WHERE collection_id=?", collectionId);
        var successorMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, successor.getId())
                .orElseThrow();
        successorMembership.setRole(workspaceRoleRepository
                .findByWorkspaceIdAndName(workspaceId, WorkspaceRole.OWNER_ROLE_NAME).orElseThrow());
        workspaceMemberRepository.saveAndFlush(successorMembership);
        entityManager.clear();
        mockMvc.perform(get("/workspaces/{workspaceId}/collections/{collectionId}/path", workspaceId, collectionId)
                        .cookie(authCookie(successor)))
                .andExpect(status().isForbidden());
        notificationRepository.deleteAll();

        var ownerMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, owner.getId())
                .orElseThrow();
        mockMvc.perform(delete("/workspaces/{workspaceId}/members/{membershipId}", workspaceId, ownerMembership.getId())
                        .cookie(authCookie(owner)).param("confirmMemberId", ownerMembership.getId().toString()))
                .andExpect(status().isNoContent());

        assertThat(notificationRepository.findAll()).filteredOn(n -> n.getRecipient().getId().equals(successor.getId()))
                .hasSize(1);
        assertThat(notificationRepository.findAll()).filteredOn(n -> n.getRecipient().getId().equals(owner.getId()))
                .hasSize(1);
        assertThat(notificationRepository.findAll()).noneMatch(n -> n.getRecipient().getId().equals(unchanged.getId()));
        mockMvc.perform(get("/workspaces/{workspaceId}/collections/{collectionId}/path", workspaceId, collectionId)
                        .cookie(authCookie(successor)))
                .andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor uniqueRemoteAddress() {
        return request -> {
            request.setRemoteAddr(UUID.randomUUID().toString());
            return request;
        };
    }
    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    void ownerGetsEffectivePermissionsIncludingSharingButNotSecretRead() throws Exception {
        User owner = createUser("Proprietário");
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id()).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isOwner").value(true))
                .andExpect(jsonPath("$.roleName").value("Owner"))
                .andExpect(jsonPath("$.permissions.length()").value(32))
                .andExpect(jsonPath("$.permissions[?(@.resource == 'group' && @.action == 'manage')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'secret' && @.action == 'read')]").isEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'sharing' && @.action == 'manage')]").isNotEmpty());
    }

    @Test
    void memberGetsOnlyRolePermissions() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());

        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id()).cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isOwner").value(false))
                .andExpect(jsonPath("$.roleName").value("Member"))
                .andExpect(jsonPath("$.permissions.length()").value(2))
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'read')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'group')]").isEmpty())
                .andExpect(jsonPath("$.permissions[?(@.action == 'create')]").isEmpty());
    }

    @Test
    void allPermissionExpandsToEveryActionForResource() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        WorkspaceRole role = new WorkspaceRole();
        role.setWorkspace(workspaceRepository.findById(workspace.id()).orElseThrow());
        role.setName("Manager");
        role = workspaceRoleRepository.saveAndFlush(role);
        RolePermission permission = new RolePermission();
        permission.setRole(role);
        permission.setResource("collection");
        permission.setAction("all");
        rolePermissionRepository.saveAndFlush(permission);
        RolePermission groupPermission = new RolePermission();
        groupPermission.setRole(role);
        groupPermission.setResource("group");
        groupPermission.setAction("all");
        rolePermissionRepository.saveAndFlush(groupPermission);
        addMember(member, workspace.id());
        var membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspace.id(), member.getId())
                .orElseThrow();
        membership.setRole(role);
        workspaceMemberRepository.saveAndFlush(membership);

        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id()).cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions.length()").value(6))
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'read')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'create')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'update')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'delete')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'collection' && @.action == 'invite')]").isNotEmpty())
                .andExpect(jsonPath("$.permissions[?(@.resource == 'group' && @.action == 'manage')]").isNotEmpty());
    }

    @Test
    void legacyTokenWithoutMembershipAndAnonymousRequestAreUnauthorized() throws Exception {
        User owner = createUser("Proprietário");
        User unrelated = createUser("Externo");
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id())
                        .cookie(authCookieWithoutMembership(unrelated)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/workspaces/{workspaceId}/me/permissions", workspace.id()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ownerListsMembersWithUserAndRoleData() throws Exception {
        User owner = createUser("Proprietário");
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/members", workspace.id()).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").isString())
                .andExpect(jsonPath("$[0].userId").value(owner.getId().toString()))
                .andExpect(jsonPath("$[0].name").value("Proprietário"))
                .andExpect(jsonPath("$[0].email").value(owner.getEmail()))
                .andExpect(jsonPath("$[0].roleId").isString())
                .andExpect(jsonPath("$[0].roleName").value("Owner"));
    }

    @Test
    void nonOwnerMemberCanListWorkspaceMembers() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());

        mockMvc.perform(get("/workspaces/{workspaceId}/members", workspace.id()).cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void nonOwnerSeesMemberNamesAndRolesButNoEmailIncludingTheirOwn() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        WorkspaceResponse workspace = configureWorkspace(owner);
        addMember(member, workspace.id());

        String response = mockMvc.perform(get("/workspaces/{workspaceId}/members", workspace.id())
                        .cookie(authCookie(member)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Map<String, Object>> members = objectMapper.readValue(response, new TypeReference<>() {});

        assertThat(members).hasSize(2).allSatisfy(memberJson -> {
            assertThat(memberJson).containsKeys("userId", "name", "roleName").doesNotContainKey("email");
        });
        assertThat(members).anySatisfy(memberJson -> assertThat(memberJson)
                .containsEntry("userId", owner.getId().toString())
                .containsEntry("name", "Proprietário")
                .containsEntry("roleName", "Owner"));
        assertThat(members).anySatisfy(memberJson -> assertThat(memberJson)
                .containsEntry("userId", member.getId().toString())
                .containsEntry("name", "Membro")
                .containsEntry("roleName", "Member"));
    }

    @Test
    void memberEmailVisibilityFollowsCurrentDatabaseOwnerInsteadOfJwtRoleClaim() throws Exception {
        User formerOwner = createUser("Proprietário anterior");
        User currentOwner = createUser("Novo proprietário");
        WorkspaceResponse workspaceResponse = configureWorkspace(formerOwner);
        addMember(currentOwner, workspaceResponse.id());
        var formerOwnerCookie = authCookie(formerOwner);

        assignRole(currentOwner, workspaceResponse.id(), WorkspaceRole.OWNER_ROLE_NAME);
        assignRole(formerOwner, workspaceResponse.id(), WorkspaceRole.MEMBER_ROLE_NAME);
        entityManager.clear();

        String formerOwnerResponse = mockMvc.perform(get("/workspaces/{workspaceId}/members", workspaceResponse.id())
                        .cookie(formerOwnerCookie))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Map<String, Object>> formerOwnerMembers = objectMapper.readValue(
                formerOwnerResponse, new TypeReference<>() {});
        assertThat(formerOwnerMembers).hasSize(2).allSatisfy(memberJson ->
                assertThat(memberJson).doesNotContainKey("email"));

        String currentOwnerResponse = mockMvc.perform(get("/workspaces/{workspaceId}/members", workspaceResponse.id())
                        .cookie(authCookie(currentOwner)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Map<String, Object>> currentOwnerMembers = objectMapper.readValue(
                currentOwnerResponse, new TypeReference<>() {});
        assertThat(currentOwnerMembers).hasSize(2).allSatisfy(memberJson ->
                assertThat(memberJson).containsKey("email"));
        assertThat(currentOwnerMembers).anySatisfy(memberJson -> assertThat(memberJson)
                .containsEntry("userId", currentOwner.getId().toString())
                .containsEntry("email", currentOwner.getEmail()));
    }

    @Test
    void userWithoutMembershipCannotListWorkspaceMembers() throws Exception {
        User owner = createUser("Proprietário");
        User unrelatedUser = createUser("Usuário externo");
        WorkspaceResponse workspace = configureWorkspace(owner);

        mockMvc.perform(get("/workspaces/{workspaceId}/members", workspace.id())
                        .cookie(authCookieWithoutMembership(unrelatedUser)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unauthenticatedUserCannotListWorkspaceMembers() throws Exception {
        mockMvc.perform(get("/workspaces/{workspaceId}/members", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void removalRequiresOwnerAndMatchingExplicitConfirmation() throws Exception {
        User owner = createUser("Proprietário");
        User member = createUser("Membro");
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(member, workspaceId);
        var membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, member.getId())
                .orElseThrow();
        String path = "/workspaces/" + workspaceId + "/members/" + membership.getId();

        mockMvc.perform(delete(path).cookie(authCookie(member)).param("confirmMemberId", membership.getId().toString()))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete(path).cookie(authCookie(owner)).param("confirmMemberId", UUID.randomUUID().toString()))
                .andExpect(status().isBadRequest());
        assertThat(workspaceMemberRepository.findById(membership.getId())).isPresent();
    }

    @Test
    void anotherOwnerCanRemoveMemberWhileRegularMemberCannot() throws Exception {
        User owner = createUser("Proprietário canônico");
        User otherOwner = createUser("Outro proprietário");
        User target = createUser("Membro alvo");
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(otherOwner, workspaceId);
        addMember(target, workspaceId);
        var ownerRole = workspaceRoleRepository
                .findByWorkspaceIdAndName(workspaceId, WorkspaceRole.OWNER_ROLE_NAME).orElseThrow();
        var otherOwnerMembership = workspaceMemberRepository
                .findByWorkspaceIdAndUserId(workspaceId, otherOwner.getId()).orElseThrow();
        otherOwnerMembership.setRole(ownerRole);
        workspaceMemberRepository.saveAndFlush(otherOwnerMembership);
        var targetMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, target.getId())
                .orElseThrow();
        var targetPath = "/workspaces/" + workspaceId + "/members/" + targetMembership.getId();

        mockMvc.perform(delete(targetPath).cookie(authCookie(target))
                        .param("confirmMemberId", targetMembership.getId().toString()))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete(targetPath).cookie(authCookie(otherOwner))
                        .param("confirmMemberId", targetMembership.getId().toString()))
                .andExpect(status().isNoContent());
        assertThat(workspaceMemberRepository.findById(targetMembership.getId())).isEmpty();
    }

    @Test
    void removalPreservesUserContentAndHistoryAndCascadesOnlyTargetMembership() throws Exception {
        User owner = createUser("Proprietário");
        User target = createUser("Membro removido");
        User other = createUser("Outro membro");
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(target, workspaceId);
        addMember(other, workspaceId);
        var targetMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, target.getId())
                .orElseThrow();
        var otherMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, other.getId())
                .orElseThrow();
        AccessGroup group = new AccessGroup();
        group.setWorkspace(workspaceRepository.findById(workspaceId).orElseThrow());
        group.setName("Equipe");
        group = groupRepository.saveAndFlush(group);
        addGroupMember(group, targetMembership.getId(), workspaceId);
        addGroupMember(group, otherMembership.getId(), workspaceId);
        mockMvc.perform(post("/workspaces/{workspaceId}/items", workspaceId).cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"text\",\"title\":\"Mantido\",\"textContent\":\"Histórico\"}"))
                .andExpect(status().isCreated());
        var login = mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + target.getEmail() + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk()).andReturn();
        String path = "/workspaces/" + workspaceId + "/members/" + targetMembership.getId();
        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(delete(path).cookie(authCookie(owner))
                        .param("confirmMemberId", targetMembership.getId().toString()))
                .andExpect(status().isNoContent());
        entityManager.flush();
        entityManager.clear();

        assertThat(userRepository.findById(target.getId())).isPresent();
        assertThat(workspaceMemberRepository.findById(targetMembership.getId())).isEmpty();
        assertThat(groupMemberRepository.findByGroupIdAndWorkspaceIdAndWorkspaceMemberId(
                group.getId(), workspaceId, otherMembership.getId())).isPresent();
        assertThat(groupMemberRepository.findByGroupIdAndWorkspaceIdAndWorkspaceMemberId(
                group.getId(), workspaceId, targetMembership.getId())).isEmpty();
        assertThat(itemRepository.findAll()).anySatisfy(item -> assertThat(item.getTitle()).isEqualTo("Mantido"));
        assertThat(jdbcTemplate.queryForMap("SELECT actor_id, snapshot FROM activity_log WHERE action = 'member_removed' AND resource_id = ?",
                targetMembership.getId())).containsEntry("actor_id", owner.getId());
        mockMvc.perform(get("/workspaces/{workspaceId}/members", workspaceId)
                        .cookie(login.getResponse().getCookie("accessToken")))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/auth/refresh").cookie(login.getResponse().getCookie("refreshToken")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void removalCannotDeleteTheLastOwner() throws Exception {
        User owner = createUser("Proprietário");
        UUID workspaceId = configureWorkspace(owner).id();
        var ownerMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, owner.getId())
                .orElseThrow();

        mockMvc.perform(delete("/workspaces/{workspaceId}/members/{membershipId}", workspaceId, ownerMembership.getId())
                        .cookie(authCookie(owner)).param("confirmMemberId", ownerMembership.getId().toString()))
                .andExpect(status().isConflict());
        assertThat(workspaceMemberRepository.findById(ownerMembership.getId())).isPresent();
    }

    @Test
    void removingOwnerTransfersOwnershipToAnotherOwnerAndKeepsThatLastOwner() throws Exception {
        User owner = createUser("Dono original");
        User successor = createUser("Dono restante");
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(successor, workspaceId);
        var successorMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, successor.getId())
                .orElseThrow();
        successorMembership.setRole(workspaceRoleRepository
                .findByWorkspaceIdAndName(workspaceId, WorkspaceRole.OWNER_ROLE_NAME).orElseThrow());
        workspaceMemberRepository.saveAndFlush(successorMembership);
        var ownerMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, owner.getId())
                .orElseThrow();

        mockMvc.perform(delete("/workspaces/{workspaceId}/members/{membershipId}", workspaceId, ownerMembership.getId())
                        .cookie(authCookie(owner)).param("confirmMemberId", ownerMembership.getId().toString()))
                .andExpect(status().isNoContent());
        entityManager.flush();
        entityManager.clear();
        assertThat(workspaceRepository.findById(workspaceId).orElseThrow().getOwner().getId()).isEqualTo(successor.getId());

        mockMvc.perform(delete("/workspaces/{workspaceId}/members/{membershipId}", workspaceId,
                                successorMembership.getId())
                        .cookie(authCookie(successor)).param("confirmMemberId", successorMembership.getId().toString()))
                .andExpect(status().isConflict());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentOwnerRemovalsCannotRemoveTheLastOwner() throws Exception {
        User owner = createUser("Dono original");
        User otherOwner = createUser("Outro dono");
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(otherOwner, workspaceId);
        var ownerMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, owner.getId())
                .orElseThrow();
        var otherMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, otherOwner.getId())
                .orElseThrow();
        otherMembership.setRole(workspaceRoleRepository
                .findByWorkspaceIdAndName(workspaceId, WorkspaceRole.OWNER_ROLE_NAME).orElseThrow());
        workspaceMemberRepository.saveAndFlush(otherMembership);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            var removeOwner = executor.submit(() -> concurrentRemove(start, owner.getId(), workspaceId, ownerMembership.getId()));
            var removeOther = executor.submit(() -> concurrentRemove(start, owner.getId(), workspaceId, otherMembership.getId()));
            start.countDown();
            var first = removeOwner.get();
            var second = removeOther.get();
            assertThat(first == null || second == null).isTrue();
        } finally {
            executor.shutdownNow();
        }
        var workspace = workspaceRepository.findById(workspaceId).orElseThrow();
        assertThat(workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, workspace.getOwner().getId()))
                .isPresent();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void workspaceRenameWaitsForOwnerRemovalAndCannotRestoreTheRemovedOwner() throws Exception {
        User owner = createUser("Dono original");
        User successor = createUser("Dono restante");
        UUID workspaceId = configureWorkspace(owner).id();
        addMember(successor, workspaceId);
        var successorMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, successor.getId())
                .orElseThrow();
        successorMembership.setRole(workspaceRoleRepository
                .findByWorkspaceIdAndName(workspaceId, WorkspaceRole.OWNER_ROLE_NAME).orElseThrow());
        workspaceMemberRepository.saveAndFlush(successorMembership);
        var ownerMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, owner.getId())
                .orElseThrow();
        CountDownLatch removalApplied = new CountDownLatch(1);
        CountDownLatch allowRemovalCommit = new CountDownLatch(1);
        CountDownLatch updateStarted = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        try {
            var removeOwner = executor.submit(() -> transaction.execute(status -> {
                workspaceMemberService.remove(owner.getId(), workspaceId, ownerMembership.getId(),
                        ownerMembership.getId());
                removalApplied.countDown();
                await(allowRemovalCommit);
                return null;
            }));
            assertThat(removalApplied.await(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            var rename = executor.submit(() -> {
                updateStarted.countDown();
                try {
                    workspaceService.update(owner.getId(), workspaceId,
                            new UpdateWorkspaceRequest("Renomeado", "Descrição"));
                    return null;
                } catch (RuntimeException exception) {
                    return exception;
                }
            });
            assertThat(updateStarted.await(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            awaitDatabaseLockWait();
            allowRemovalCommit.countDown();
            removeOwner.get();
            assertThat(rename.get()).isInstanceOf(ResourceNotFoundException.class);
        } finally {
            allowRemovalCommit.countDown();
            executor.shutdownNow();
        }
        var workspace = workspaceRepository.findById(workspaceId).orElseThrow();
        assertThat(workspace.getOwner().getId()).isEqualTo(successor.getId());
        assertThat(workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, successor.getId())).isPresent();
        assertThat(workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, owner.getId())).isEmpty();
    }

    private void awaitDatabaseLockWait() throws InterruptedException {
        long deadline = System.nanoTime() + Duration.ofSeconds(10).toNanos();
        while (System.nanoTime() < deadline) {
            Integer waiting = jdbcTemplate.queryForObject("""
                    SELECT count(*) FROM pg_stat_activity
                    WHERE datname = current_database() AND pid <> pg_backend_pid()
                      AND state = 'active' AND wait_event_type = 'Lock'
                    """, Integer.class);
            if (waiting != null && waiting > 0) {
                return;
            }
            Thread.sleep(25);
        }
        throw new AssertionError("A atualização não aguardou o lock de remoção");
    }

    private void await(CountDownLatch latch) {
        try {
            if (!latch.await(10, java.util.concurrent.TimeUnit.SECONDS)) {
                throw new IllegalStateException("Tempo esgotado aguardando a liberação da remoção");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }

    private RuntimeException concurrentRemove(CountDownLatch start, UUID actorId, UUID workspaceId, UUID membershipId) {
        try {
            start.await();
            workspaceMemberService.remove(actorId, workspaceId, membershipId, membershipId);
            return null;
        } catch (RuntimeException exception) {
            return exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }

    private void addGroupMember(AccessGroup group, UUID memberId, UUID workspaceId) {
        var member = workspaceMemberRepository.findById(memberId).orElseThrow();
        AccessGroupMember association = new AccessGroupMember();
        association.setGroup(group);
        association.setWorkspaceMember(member);
        association.setWorkspaceId(workspaceId);
        groupMemberRepository.saveAndFlush(association);
    }
}
