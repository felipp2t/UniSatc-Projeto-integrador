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

    @Column(nullable = false, length = 10)
    private String format;

    @Column(nullable = false)
    private Integer width;

    @Column(nullable = false)
    private Integer height;
}
