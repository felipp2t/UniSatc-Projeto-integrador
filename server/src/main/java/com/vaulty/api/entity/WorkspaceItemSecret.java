package com.vaulty.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "item_secret")
@Getter
@Setter
@NoArgsConstructor
public class WorkspaceItemSecret {

    @Id
    private UUID itemId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", insertable = false, updatable = false)
    private WorkspaceItem item;

    @Column(nullable = false, columnDefinition = "text")
    private String value;
}
