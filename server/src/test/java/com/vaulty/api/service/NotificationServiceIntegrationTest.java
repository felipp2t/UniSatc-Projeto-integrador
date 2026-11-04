package com.vaulty.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.dto.user.UpdateProfileRequest;
import com.vaulty.api.entity.Notification;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.exception.TooManyRequestsException;
import com.vaulty.api.repository.NotificationRepository;
import com.vaulty.api.repository.UserRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.io.IOException;
import java.time.Duration;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@AutoConfigureMockMvc
@Import(NotificationServiceIntegrationTest.StreamProbeConfiguration.class)
class NotificationServiceIntegrationTest extends PostgresIntegrationTest {

    @Autowired private NotificationRepository notificationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private WorkspaceMemberRepository workspaceMemberRepository;
    @Autowired private WorkspaceRepository workspaceRepository;
    @Autowired private WorkspaceRoleRepository workspaceRoleRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private UserService userService;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private MockMvc mockMvc;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private StreamProbeController streamProbeController;

    @BeforeEach
    void clearNotifications() {
        notificationRepository.deleteAll();
    }

    @Test
    void listIsScopedToAuthenticatedRecipientAndBoundsPageSize() throws Exception {
        User owner = createUser();
        User other = createUser();
        for (int index = 0; index < 102; index++) {
            notificationService.profileUpdated(owner.getId());
        }
        UUID newestId = notificationRepository.findAll().stream()
                .filter(notification -> notification.getRecipient().getId().equals(owner.getId()))
                .findFirst().orElseThrow().getId();
        jdbcTemplate.update("UPDATE notification SET created_at = now() + interval '1 day' WHERE id = ?", newestId);
        notificationService.passwordChanged(other.getId());

        mockMvc.perform(get("/notifications?page=0&size=100")
                        .cookie(accessCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(100))
                .andExpect(jsonPath("$.totalItems").value(102))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.notifications.length()").value(100))
                .andExpect(jsonPath("$.notifications[0].id").value(newestId.toString()))
                .andExpect(jsonPath("$.notifications[0].metadata.event").value("PROFILE_UPDATED"));

        mockMvc.perform(get("/notifications?page=1&size=100")
                        .cookie(accessCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notifications.length()").value(2));

        mockMvc.perform(get("/notifications?page=0&size=101").cookie(accessCookie(owner)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listRejectsOffsetThatCannotBeRepresentedAsAnInteger() throws Exception {
        User owner = createUser();

        mockMvc.perform(get("/notifications?page=21474837&size=100")
                        .cookie(accessCookie(owner)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void markReadIsIdempotentAndCannotAccessAnotherUsersNotification() throws Exception {
        User owner = createUser();
        User other = createUser();
        notificationService.profileUpdated(owner.getId());
        notificationService.passwordChanged(other.getId());
        List<Notification> notifications = notificationRepository.findAll();
        Notification own = notifications.stream()
                .filter(notification -> notification.getRecipient().getId().equals(owner.getId()))
                .findFirst().orElseThrow();
        Notification foreign = notifications.stream()
                .filter(notification -> notification.getRecipient().getId().equals(other.getId()))
                .findFirst().orElseThrow();

        mockMvc.perform(patch("/notifications/{id}/read", own.getId()).cookie(accessCookie(owner)))
                .andExpect(status().isNoContent());
        var firstReadAt = notificationRepository.findById(own.getId()).orElseThrow().getReadAt();
        mockMvc.perform(patch("/notifications/{id}/read", own.getId()).cookie(accessCookie(owner)))
                .andExpect(status().isNoContent());
        assertThat(notificationRepository.findById(own.getId()).orElseThrow().getReadAt()).isEqualTo(firstReadAt);

        mockMvc.perform(patch("/notifications/{id}/read", foreign.getId()).cookie(accessCookie(owner)))
                .andExpect(status().isNotFound());
        assertThat(notificationRepository.findById(foreign.getId()).orElseThrow().getReadAt()).isNull();
    }

    @Test
    void unreadFilterAndCountIgnoreReadNotificationsAndOtherRecipients() throws Exception {
        User owner = createUser();
        User other = createUser();
        notificationService.profileUpdated(owner.getId());
        notificationService.passwordChanged(owner.getId());
        notificationService.passwordChanged(other.getId());
        Notification read = notificationRepository.findAll().stream()
                .filter(notification -> notification.getRecipient().getId().equals(owner.getId()))
                .findFirst().orElseThrow();
        mockMvc.perform(patch("/notifications/{id}/read", read.getId()).cookie(accessCookie(owner)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/notifications?unread=true").cookie(accessCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.notifications[0].readAt").doesNotExist())
                .andExpect(jsonPath("$.unreadCount").value(1));
        mockMvc.perform(get("/notifications?page=0&size=1").cookie(accessCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.unreadCount").value(1));
    }

    @Test
    void markAllReadOnlyAffectsOwnUnreadNotificationsAndKeepsExistingReadAt() throws Exception {
        User owner = createUser();
        User other = createUser();
        notificationService.profileUpdated(owner.getId());
        notificationService.passwordChanged(owner.getId());
        notificationService.passwordChanged(other.getId());
        List<Notification> ownNotifications = notificationRepository.findAll().stream()
                .filter(notification -> notification.getRecipient().getId().equals(owner.getId()))
                .toList();
        mockMvc.perform(patch("/notifications/{id}/read", ownNotifications.get(0).getId())
                        .cookie(accessCookie(owner)))
                .andExpect(status().isNoContent());
        var firstReadAt = notificationRepository.findById(ownNotifications.get(0).getId()).orElseThrow().getReadAt();

        mockMvc.perform(patch("/notifications/read").cookie(accessCookie(owner)))
                .andExpect(status().isNoContent());
        mockMvc.perform(patch("/notifications/read").cookie(accessCookie(owner)))
                .andExpect(status().isNoContent());

        assertThat(notificationRepository.findById(ownNotifications.get(0).getId()).orElseThrow().getReadAt())
                .isEqualTo(firstReadAt);
        assertThat(notificationRepository.findById(ownNotifications.get(1).getId()).orElseThrow().getReadAt())
                .isNotNull();
        assertThat(notificationRepository.countByRecipientIdAndReadAtIsNull(owner.getId())).isZero();
        assertThat(notificationRepository.countByRecipientIdAndReadAtIsNull(other.getId())).isEqualTo(1);
    }

    @Test
    void notificationRoutesRequireAuthentication() throws Exception {
        mockMvc.perform(get("/notifications")).andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/notifications/read")).andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/notifications/{id}/read", UUID.randomUUID())).andExpect(status().isUnauthorized());
    }

    @Test
    void concurrentMarkReadCallsPreserveTheOriginalReadTimestamp() throws Exception {
        User owner = createUser();
        notificationService.profileUpdated(owner.getId());
        Notification notification = notificationRepository.findAll().get(0);
        jdbcTemplate.update("UPDATE notification SET read_at = TIMESTAMPTZ '2020-01-01 00:00:00+00' WHERE id = ?",
                notification.getId());
        var originalReadAt = notificationRepository.findById(notification.getId()).orElseThrow().getReadAt();
        int parallelCalls = 8;
        CountDownLatch ready = new CountDownLatch(parallelCalls);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(parallelCalls);

        try {
            List<java.util.concurrent.Future<Object>> calls = java.util.stream.IntStream.range(0, parallelCalls)
                    .mapToObj(ignored -> executor.submit(() -> {
                        ready.countDown();
                        if (!start.await(5, TimeUnit.SECONDS)) {
                            throw new AssertionError("Concurrent mark-read calls did not start");
                        }
                        notificationService.markRead(owner.getId(), notification.getId());
                        return null;
                    }))
                    .toList();
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (var call : calls) {
                call.get(10, TimeUnit.SECONDS);
            }
        } finally {
            executor.shutdownNow();
        }

        assertThat(notificationRepository.findById(notification.getId()).orElseThrow().getReadAt())
                .isEqualTo(originalReadAt);
    }

    @Test
    void profileAndPasswordChangesPersistOnlyFixedEventsWithoutCredentialData() {
        User user = createUser();

        userService.updateProfile(user.getId(), new UpdateProfileRequest("Updated Name"));
        userService.changePassword(user.getId(), new com.vaulty.api.dto.user.ChangePasswordRequest(
                "old-password", "secret-new-password", "secret-new-password"));

        List<Notification> notifications = notificationRepository.findAll();
        assertThat(notifications).hasSize(2);
        assertThat(notifications).extracting(notification -> notification.getMetadata().get("event"))
                .containsExactlyInAnyOrder("PROFILE_UPDATED", "PASSWORD_CHANGED");
        assertThat(notifications).allSatisfy(notification -> {
            assertThat(notification.getTitle()).doesNotContain("secret");
            assertThat(notification.getContent()).doesNotContain("secret");
            assertThat(notification.getMetadata()).doesNotContainKeys("password", "passwordHash", "token");
        });
    }

    @Test
    void accessChangedDeduplicatesRecipientsAndTransactionRollbackRemovesNotifications() {
        User user = createUser();
        notificationService.accessChanged(List.of(user.getId(), user.getId()));
        assertThat(notificationRepository.findAll()).hasSize(1);
        assertThat(notificationRepository.findAll().get(0).getMetadata().get("event"))
                .isEqualTo("ACCESS_CHANGED");

        transactionTemplate.executeWithoutResult(status -> {
            notificationService.profileUpdated(user.getId());
            status.setRollbackOnly();
        });
        assertThat(notificationRepository.findAll()).hasSize(1);
    }

    @Test
    void legacyAccessChangedReferencesAreSanitizedBeforeReturningToRecipient() throws Exception {
        User owner = createUser();
        notificationService.accessChanged(List.of(owner.getId()));
        Notification notification = notificationRepository.findAll().get(0);
        jdbcTemplate.update("""
                UPDATE notification SET title=?, content=?, metadata=?::jsonb WHERE id=?
                """, "Restricted title", "Restricted path /secret/link", """
                {"event":"ACCESS_CHANGED","title":"restricted","path":"/secret","link":"/secret",
                 "secret":"value","itemId":"00000000-0000-0000-0000-000000000001"}
                """, notification.getId());

        mockMvc.perform(get("/notifications?page=0&size=20").cookie(accessCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notifications[0].title").value("Acesso atualizado"))
                .andExpect(jsonPath("$.notifications[0].content")
                        .value("As permissões de acesso da sua conta foram atualizadas."))
                .andExpect(jsonPath("$.notifications[0].metadata.event").value("ACCESS_CHANGED"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
                        .string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("Restricted"))))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
                        .string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("/secret"))));
    }

    @Test
    void streamLimitAppliesPerRecipient() {
        User owner = createUser();
        User other = createUser();
        List<SseEmitter> ownerStreams = List.of(
                notificationService.subscribe(owner.getId()),
                notificationService.subscribe(owner.getId()),
                notificationService.subscribe(owner.getId()),
                notificationService.subscribe(owner.getId()),
                notificationService.subscribe(owner.getId()));

        assertThatThrownBy(() -> notificationService.subscribe(owner.getId()))
                .isInstanceOf(TooManyRequestsException.class);
        assertThat(notificationService.subscribe(other.getId())).isNotNull();
        ownerStreams.forEach(SseEmitter::complete);
    }

    @Test
    void streamSendsOnlyTheCommittedNotificationIdToItsRecipient() throws Exception {
        User owner = createUser();
        User other = createUser();
        MvcResult ownerStream = openStream(owner);
        SseEmitter ownerEmitter = streamProbeController.emitterFor(owner.getId());
        MvcResult otherStream = openStream(other);
        SseEmitter otherEmitter = streamProbeController.emitterFor(other.getId());

        try {
            transactionTemplate.executeWithoutResult(status -> {
                notificationService.profileUpdated(owner.getId());
                status.setRollbackOnly();
            });
            assertThat(ownerStream.getResponse().getContentAsString()).isEmpty();

            long startedAt = System.nanoTime();
            notificationService.profileUpdated(owner.getId());
            Duration deliveryTime = Duration.ofNanos(System.nanoTime() - startedAt);
            Notification persisted = notificationRepository.findAll().stream()
                    .filter(notification -> notification.getRecipient().getId().equals(owner.getId()))
                    .findFirst().orElseThrow();

            String ownerPayload = ownerStream.getResponse().getContentAsString();
            assertThat(ownerPayload).contains("event:notification", "id:" + persisted.getId(),
                    "data:\"" + persisted.getId() + "\"");
            assertThat(deliveryTime).isLessThan(Duration.ofSeconds(5));
            assertThat(ownerPayload).doesNotContain(persisted.getTitle(), persisted.getContent());
            assertThat(otherStream.getResponse().getContentAsString()).isEmpty();
            ownerEmitter.complete();
            mockMvc.perform(get("/notifications?page=0&size=20").cookie(accessCookie(owner)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.notifications[0].id").value(persisted.getId().toString()))
                    .andExpect(jsonPath("$.notifications[0].metadata.event").value("PROFILE_UPDATED"));
        } finally {
            ownerEmitter.complete();
            otherEmitter.complete();
        }
    }

    @Test
    void heartbeatKeepsStreamAliveWithoutEmittingNotificationEvents() throws Exception {
        User owner = createUser();
        MvcResult ownerStream = openStream(owner);
        SseEmitter ownerEmitter = streamProbeController.emitterFor(owner.getId());

        try {
            notificationService.sendHeartbeat();

            String payload = ownerStream.getResponse().getContentAsString();
            assertThat(payload).contains(":keep-alive").doesNotContain("event:notification");
            assertThat(notificationRepository.findAll()).isEmpty();
        } finally {
            ownerEmitter.complete();
        }
    }

    @Test
    void streamDoesNotOutliveTheAccessToken() {
        User owner = createUser();
        SseEmitter emitter = notificationService.subscribe(owner.getId());

        assertThat(emitter.getTimeout()).isEqualTo(900_000L);
        emitter.complete();
    }

    @Test
    void failedRealtimeDeliveryKeepsTheOperationAndThePersistedNotification() {
        User owner = createUser();
        SseEmitter brokenStream = notificationService.subscribe(owner.getId());
        brokenStream.complete();

        notificationService.profileUpdated(owner.getId());

        assertThat(notificationRepository.findAll()).singleElement()
                .satisfies(notification -> assertThat(notification.getRecipient().getId()).isEqualTo(owner.getId()));
    }

    @Test
    @SuppressWarnings("unchecked")
    void failedRealtimeSendDoesNotUndoPersistedNotification() {
        User owner = createUser();
        AtomicBoolean failureObserved = new AtomicBoolean();
        SseEmitter failingEmitter = new SseEmitter() {
            @Override
            public void send(SseEventBuilder builder) throws IOException {
                throw new IOException("simulated disconnected client");
            }

            @Override
            public void completeWithError(Throwable failure) {
                failureObserved.set(true);
            }
        };
        Map<UUID, Set<SseEmitter>> emitters =
                (Map<UUID, Set<SseEmitter>>) ReflectionTestUtils.getField(notificationService, "emitters");
        emitters.put(owner.getId(), ConcurrentHashMap.newKeySet());
        emitters.get(owner.getId()).add(failingEmitter);

        notificationService.accessChanged(List.of(owner.getId()));

        assertThat(failureObserved).isTrue();
        assertThat(notificationRepository.findAll()).filteredOn(n -> n.getRecipient().getId().equals(owner.getId()))
                .extracting(n -> n.getMetadata().get("event")).containsExactly("ACCESS_CHANGED");
    }

    private MvcResult openStream(User user) throws Exception {
        return mockMvc.perform(get("/test-notifications/stream").cookie(accessCookie(user)))
                .andExpect(request().asyncStarted())
                .andReturn();
    }

    @TestConfiguration
    static class StreamProbeConfiguration {
        @Bean
        StreamProbeController streamProbeController(NotificationService notificationService) {
            return new StreamProbeController(notificationService);
        }
    }

    @RestController
    static class StreamProbeController {
        private final NotificationService notificationService;
        private final java.util.concurrent.ConcurrentMap<UUID, SseEmitter> activeStreams =
                new java.util.concurrent.ConcurrentHashMap<>();

        StreamProbeController(NotificationService notificationService) {
            this.notificationService = notificationService;
        }

        @GetMapping(path = "/test-notifications/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
        SseEmitter stream(@AuthenticationPrincipal UUID recipientId) {
            SseEmitter emitter = notificationService.subscribe(recipientId);
            activeStreams.put(recipientId, emitter);
            return emitter;
        }

        SseEmitter emitterFor(UUID recipientId) {
            return activeStreams.get(recipientId);
        }
    }

    private User createUser() {
        User user = new User();
        user.setName("Notification Test");
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("old-password"));
        userRepository.saveAndFlush(user);

        var workspace = workspaceRepository.findSingleton().orElseThrow();
        var role = workspaceRoleRepository.findByWorkspaceIdAndName(
                workspace.getId(), WorkspaceRole.MEMBER_ROLE_NAME).orElseThrow();
        var membership = new WorkspaceMember();
        membership.setUser(user);
        membership.setWorkspace(workspace);
        membership.setRole(role);
        workspaceMemberRepository.saveAndFlush(membership);
        return user;
    }

    private Cookie accessCookie(User user) {
        UUID membershipId = workspaceMemberRepository.findByUserId(user.getId()).orElseThrow().getId();
        return new Cookie("accessToken", jwtService.generateAccessToken(user.getId(), membershipId, null));
    }
}
