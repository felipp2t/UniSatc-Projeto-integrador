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
@Table(name = "item_media")
@Getter
@Setter
@NoArgsConstructor
public class WorkspaceItemMedia {
    @Id
    @Column(name = "item_id")
    private UUID itemId;

    @Column(name = "width_px", nullable = false)
    private int widthPx;

    @Column(name = "height_px", nullable = false)
    private int heightPx;

    @Column(nullable = false, length = 10)
    private String format;
}
