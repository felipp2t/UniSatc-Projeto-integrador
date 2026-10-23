package com.vaulty.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "item_file")
@Getter
@Setter
@NoArgsConstructor
public class WorkspaceItemFile {

    @Id
    @Column(name = "item_id")
    private UUID itemId;

    @Column(name = "storage_key", nullable = false, unique = true, length = 1024)
    private String storageKey;

    @Column(name = "original_name", nullable = false, length = 255)
    private String originalName;

    @Column(name = "mime_type", nullable = false, length = 127)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;
}
