package com.vaulty.api.service;

import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.WorkspaceRepository;
import java.util.Collection;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import jakarta.persistence.EntityManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.stereotype.Service;

@Service
public class WorkspaceAccessNotifications {

    private final EffectiveContentAccess access;
    private final WorkspaceRepository workspaceRepository;
    private final NotificationService notifications;
    private final EntityManager entityManager;

    public WorkspaceAccessNotifications(EffectiveContentAccess access,
            WorkspaceRepository workspaceRepository, NotificationService notifications, EntityManager entityManager) {
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
        workspaceRepository.findById(workspaceId).orElseThrow();
        return access.readableResourcesByMember(workspaceId);
    }

    public void notifyChanged(Map<UUID, Set<String>> before, Map<UUID, Set<String>> after) {
        notifyChanged(before, after, Set.of());
    }

    public void notifyChanged(Map<UUID, Set<String>> before, Map<UUID, Set<String>> after,
            Collection<UUID> explicitlyAffected) {
        Set<UUID> affected = new HashSet<>();
        Set<UUID> users = new HashSet<>(before.keySet());
        users.addAll(after.keySet());
        for (UUID user : users) {
            if (!before.getOrDefault(user, Set.of()).equals(after.getOrDefault(user, Set.of()))) {
                affected.add(user);
            }
        }
        affected.addAll(explicitlyAffected);
        notifications.accessChanged(affected);
    }
}
