package com.vaulty.api.service;

import com.vaulty.api.entity.Workspace;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.WorkspaceRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import jakarta.persistence.EntityManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class WorkspaceAccessNotifications {

    private final JdbcTemplate jdbc;
    private final EffectiveContentAccess access;
    private final WorkspaceRepository workspaceRepository;
    private final NotificationService notifications;
    private final EntityManager entityManager;

    public WorkspaceAccessNotifications(JdbcTemplate jdbc, EffectiveContentAccess access,
            WorkspaceRepository workspaceRepository, NotificationService notifications, EntityManager entityManager) {
        this.jdbc = jdbc;
        this.access = access;
        this.workspaceRepository = workspaceRepository;
        this.notifications = notifications;
        this.entityManager = entityManager;
    }

    public Map<UUID, Set<String>> snapshot(UUID workspaceId) {
        return readSnapshot(workspaceId);
    }

    public void lockWorkspace(UUID workspaceId) {
        // ponytail: serializes workspace administration; split locks if throughput becomes a bottleneck.
        workspaceRepository.findByIdForUpdate(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
    }

    public Map<UUID, Set<String>> snapshotAfterChange(UUID workspaceId) {
        if (TransactionSynchronizationManager.isActualTransactionActive()
                && !TransactionSynchronizationManager.isCurrentTransactionReadOnly()) {
            entityManager.flush();
        }
        return readSnapshot(workspaceId);
    }

    private Map<UUID, Set<String>> readSnapshot(UUID workspaceId) {
        Workspace workspace = workspaceRepository.findById(workspaceId).orElseThrow();
        List<UUID> users = jdbc.queryForList(
                "SELECT user_id FROM workspace_member WHERE workspace_id=?", UUID.class, workspaceId);
        List<UUID> collections = jdbc.queryForList(
                "SELECT id FROM collection WHERE workspace_id=?", UUID.class, workspaceId);
        List<UUID> items = jdbc.queryForList(
                "SELECT id FROM item WHERE workspace_id=?", UUID.class, workspaceId);
        Map<UUID, Set<String>> result = new HashMap<>();
        // ponytail: scans every member/resource pair; paginate only if workspace sizes make this costly.
        for (UUID user : users) {
            Set<String> readable = new HashSet<>();
            readable.add("member");
            for (UUID collection : collections) {
                if (access.canReadCollection(user, workspace, collection)) readable.add("c:" + collection);
            }
            for (UUID item : items) {
                if (access.canReadItem(user, workspace, item)) readable.add("i:" + item);
            }
            result.put(user, Set.copyOf(readable));
        }
        return Map.copyOf(result);
    }

    public void notifyChanged(Map<UUID, Set<String>> before, Map<UUID, Set<String>> after) {
        Set<UUID> affected = new HashSet<>();
        Set<UUID> users = new HashSet<>(before.keySet());
        users.addAll(after.keySet());
        for (UUID user : users) {
            if (!before.getOrDefault(user, Set.of()).equals(after.getOrDefault(user, Set.of()))) {
                affected.add(user);
            }
        }
        notifications.accessChanged(affected);
    }
}
