package com.vaulty.api.service;

import com.vaulty.api.dto.notification.NotificationPageResponse;
import com.vaulty.api.dto.notification.NotificationResponse;
import com.vaulty.api.entity.Notification;
import com.vaulty.api.entity.User;
import com.vaulty.api.enums.NotificationEvent;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.exception.TooManyRequestsException;
import com.vaulty.api.exception.ValidationException;
import com.vaulty.api.repository.NotificationRepository;
import com.vaulty.api.repository.UserRepository;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class NotificationService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_STREAMS_PER_USER = 5;
    private static final long STREAM_TIMEOUT_MS = 30 * 60 * 1000L;

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final Map<UUID, Set<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public NotificationService(NotificationRepository notificationRepository, UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public NotificationPageResponse list(UUID recipientId, int page, int size) {
        validatePage(page, size);
        var pageable = PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        return NotificationPageResponse.from(notificationRepository.findAllByRecipientId(recipientId, pageable)
                .map(NotificationResponse::from));
    }

    @Transactional
    public void markRead(UUID recipientId, UUID notificationId) {
        if (notificationRepository.markRead(notificationId, recipientId, OffsetDateTime.now()) == 0) {
            throw new ResourceNotFoundException("Notificação não encontrada");
        }
    }

    @Transactional
    public void profileUpdated(UUID recipientId) {
        publish(recipientId, NotificationEvent.PROFILE_UPDATED);
    }

    @Transactional
    public void passwordChanged(UUID recipientId) {
        publish(recipientId, NotificationEvent.PASSWORD_CHANGED);
    }

    // Producers for future role, group, sharing, and inherited permission changes use only this fixed event.
    @Transactional
    public void accessChanged(Collection<UUID> affectedRecipients) {
        affectedRecipients.stream().distinct().forEach(id -> publish(id, NotificationEvent.ACCESS_CHANGED));
    }

    public SseEmitter subscribe(UUID recipientId) {
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MS);
        emitters.compute(recipientId, (ignored, userEmitters) -> {
            Set<SseEmitter> registered = userEmitters == null ? ConcurrentHashMap.newKeySet() : userEmitters;
            if (registered.size() >= MAX_STREAMS_PER_USER) {
                throw new TooManyRequestsException("Limite de conexões de notificações atingido");
            }
            registered.add(emitter);
            return registered;
        });
        Runnable cleanup = () -> removeEmitter(recipientId, emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(() -> {
            cleanup.run();
            emitter.complete();
        });
        emitter.onError(ignored -> cleanup.run());
        return emitter;
    }

    private void publish(UUID recipientId, NotificationEvent eventType) {
        User recipient = userRepository.getReferenceById(recipientId);
        Notification notification = new Notification();
        notification.setRecipient(recipient);
        notification.setTitle(eventType.title());
        notification.setContent(eventType.content());
        notification.setMetadata(Map.of("event", eventType.name()));
        Notification saved = notificationRepository.save(notification);
        UUID notificationId = saved.getId();

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        emit(recipientId, notificationId);
                    } catch (RuntimeException ignored) {
                        // Realtime delivery is best effort; persisted notifications remain available via GET.
                    }
                }
            });
        }
    }

    private void emit(UUID recipientId, UUID notificationId) {
        Set<SseEmitter> userEmitters = emitters.get(recipientId);
        if (userEmitters == null) {
            return;
        }
        for (SseEmitter emitter : userEmitters) {
            try {
                emitter.send(SseEmitter.event().name("notification").id(notificationId.toString())
                        .data(notificationId));
            } catch (Exception exception) {
                removeEmitter(recipientId, emitter);
                try {
                    emitter.completeWithError(exception);
                } catch (IllegalStateException ignored) {
                    // The connection may already have completed.
                }
            }
        }
    }

    private void removeEmitter(UUID recipientId, SseEmitter emitter) {
        emitters.computeIfPresent(recipientId, (ignored, userEmitters) -> {
            userEmitters.remove(emitter);
            return userEmitters.isEmpty() ? null : userEmitters;
        });
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE || (long) page * size > Integer.MAX_VALUE) {
            throw new ValidationException("Página ou tamanho inválido");
        }
    }
}
