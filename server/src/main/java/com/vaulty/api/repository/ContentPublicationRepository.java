package com.vaulty.api.repository;

import com.vaulty.api.entity.ContentPublication;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContentPublicationRepository extends JpaRepository<ContentPublication, UUID> {

    @Query("select publication from ContentPublication publication "
            + "where publication.workspaceId = :workspaceId "
            + "and publication.sourceCollection.id = :sourceCollectionId "
            + "order by publication.createdAt desc")
    List<ContentPublication> findAllByWorkspaceIdAndSourceCollection(
            @Param("workspaceId") UUID workspaceId,
            @Param("sourceCollectionId") UUID sourceCollectionId);

    @Query("select publication from ContentPublication publication "
            + "join fetch publication.originalItem item "
            + "where publication.workspaceId = :workspaceId "
            + "and publication.destinationCollection.id = :destinationCollectionId "
            + "and publication.originalType = com.vaulty.api.enums.ContentPublicationType.ITEM")
    List<ContentPublication> findReceivedItems(
            @Param("workspaceId") UUID workspaceId,
            @Param("destinationCollectionId") UUID destinationCollectionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select publication from ContentPublication publication "
            + "join fetch publication.sourceCollection source "
            + "where publication.id = :id and publication.workspaceId = :workspaceId")
    Optional<ContentPublication> findByIdAndWorkspaceIdForUpdate(
            @Param("id") UUID id, @Param("workspaceId") UUID workspaceId);
}
