package com.vaulty.api.repository;

import com.vaulty.api.entity.Notification;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findAllByRecipientId(UUID recipientId, Pageable pageable);

    @Modifying
    @Query("update Notification n set n.readAt = coalesce(n.readAt, :readAt) "
            + "where n.id = :id and n.recipient.id = :recipientId")
    int markRead(@Param("id") UUID id, @Param("recipientId") UUID recipientId,
                 @Param("readAt") OffsetDateTime readAt);
}
