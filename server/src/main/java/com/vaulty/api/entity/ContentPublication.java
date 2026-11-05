package com.vaulty.api.entity;

import com.vaulty.api.enums.ContentPublicationType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "content_publication")
@Getter
@Setter
@NoArgsConstructor
public class ContentPublication {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "original_type", nullable = false, length = 20)
    private ContentPublicationType originalType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_item_id")
    private WorkspaceItem originalItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_collection_id")
    private WorkspaceCollection originalCollection;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_collection_id", nullable = false)
    private WorkspaceCollection sourceCollection;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_collection_id", nullable = false)
    private WorkspaceCollection destinationCollection;

    @Column(name = "source_team_name", nullable = false, length = 50)
    private String sourceTeamName;

    @Column(name = "captured_path", nullable = false, columnDefinition = "text")
    private String capturedPath;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
