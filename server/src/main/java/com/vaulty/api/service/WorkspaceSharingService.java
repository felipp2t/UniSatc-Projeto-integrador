package com.vaulty.api.service;

import com.vaulty.api.dto.sharing.CreatePublicationRequest;
import com.vaulty.api.dto.sharing.PublicationConfiguration;
import com.vaulty.api.dto.sharing.PublicationResponse;
import com.vaulty.api.entity.ContentPublication;
import com.vaulty.api.entity.WorkspaceCollection;
import com.vaulty.api.entity.WorkspaceItem;
import com.vaulty.api.enums.ContentPublicationType;
import com.vaulty.api.enums.GlobalRole;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.dto.notification.NotificationResourceReference;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ForbiddenException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.ContentPublicationRepository;
import com.vaulty.api.repository.WorkspaceCollectionRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceTeamRepository;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceSharingService {

    private final JdbcTemplate jdbc;
    private final WorkspaceContentAuthorization authorization;
    private final WorkspaceMemberRepository memberRepository;
    private final WorkspaceTeamRepository teamRepository;
    private final WorkspaceCollectionRepository collectionRepository;
    private final ContentPublicationRepository publicationRepository;
    private final WorkspaceAccessNotifications accessNotifications;
    private final ReceivedContentProjectionService receivedProjection;
    private final EntityManager entityManager;
    private final ActivityLogService activityLog;

    @Transactional
    public PublicationResponse publish(UUID userId, UUID workspaceId, CreatePublicationRequest request) {
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        authorization.requireWorkspace(userId, workspaceId);
        var member = memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        if (member.getTeam() == null || !member.getTeam().getLeader().getId().equals(member.getId())) {
            throw new ForbiddenException("Somente o Líder atual pode publicar conteúdo");
        }

        var sourceTeam = teamRepository.findByIdAndWorkspaceIdForUpdate(member.getTeam().getId(), workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Time não encontrado"));
        var destination = teamRepository.findByIdAndWorkspaceId(request.destinationTeamId(), workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Time de destino não encontrado"));
        if (sourceTeam.getId().equals(destination.getId())) {
            throw new ConflictException("O destino deve ser outro time");
        }
        var before = accessNotifications.snapshot(workspaceId);

        ContentPublication publication = new ContentPublication();
        publication.setWorkspaceId(workspaceId);
        publication.setSourceCollection(sourceTeam.getRootCollection());
        publication.setDestinationCollection(destination.getRootCollection());
        publication.setSourceTeamName(sourceTeam.getName());
        publication.setOriginalType(request.originalType());

        String capturedPath;
        if (request.originalType() == ContentPublicationType.COLLECTION) {
            WorkspaceCollection folder = collectionRepository.findByIdAndWorkspaceId(request.originalId(), workspaceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Pasta não encontrada"));
            var path = collectionRepository.findPath(workspaceId, folder.getId());
            requireInsideSource(path.stream().map(entry -> entry.getId()).toList(), sourceTeam.getRootCollection().getId());
            publication.setOriginalCollection(folder);
            var names = path.stream().map(entry -> entry.getName()).toList();
            capturedPath = names.size() <= 2 ? "" : String.join("/", names.subList(1, names.size() - 1));
        } else {
            var item = jdbc.query("SELECT id, collection_id FROM item WHERE id=? AND workspace_id=?",
                    resultSet -> resultSet.next() ? new ItemOrigin(
                            resultSet.getObject("id", UUID.class),
                            resultSet.getObject("collection_id", UUID.class)) : null,
                    request.originalId(), workspaceId);
            if (item == null || item.collectionId() == null) {
                throw new ResourceNotFoundException("Item não encontrado");
            }
            var path = collectionRepository.findPath(workspaceId, item.collectionId());
            requireInsideSource(path.stream().map(entry -> entry.getId()).toList(), sourceTeam.getRootCollection().getId());
            publication.setOriginalItem(entityManager.getReference(WorkspaceItem.class, item.id()));
            capturedPath = relativePath(path.stream().map(entry -> entry.getName()).toList());
        }
        publication.setCapturedPath(capturedPath);
        try {
            var saved = publicationRepository.saveAndFlush(publication);
            receivedProjection.refresh(workspaceId, destination.getRootCollection().getId());
            activityLog.record(workspaceId, userId, ActivityActorContext.USER,
                    ActivityAction.CONTENT_PUBLISHED, ActivityResourceType.PUBLICATION, saved.getId(),
                    java.util.Map.of("publicationId", saved.getId(),
                            "sourceCollectionId", sourceTeam.getRootCollection().getId(),
                            "destinationCollectionId", destination.getRootCollection().getId(),
                            "originalId", request.originalId(), "originalType", saved.getOriginalType().name()));
            accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspaceId),
                    memberRepository.findAllByTeamId(destination.getId()).stream()
                            .map(teamMember -> teamMember.getUser().getId()).toList(),
                    new NotificationResourceReference(workspaceId, NotificationResourceReference.Type.COLLECTION,
                            destination.getRootCollection().getId()));
            return response(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("Esse original já está publicado para o time de destino");
        }
    }

    @Transactional
    public void revoke(UUID userId, UUID workspaceId, UUID publicationId) {
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        var publication = publicationRepository.findByIdAndWorkspaceIdForUpdate(publicationId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Publicação não encontrada"));
        UUID sourceCollectionId = publication.getSourceCollection().getId();
        UUID originalId = publication.getOriginalType() == ContentPublicationType.ITEM
                ? publication.getOriginalItem().getId() : publication.getOriginalCollection().getId();
        ContentPublicationType originalType = publication.getOriginalType();
        UUID sourceTeamId = jdbc.query("SELECT id FROM workspace_team WHERE workspace_id=? AND root_collection_id=?",
                resultSet -> resultSet.next() ? resultSet.getObject("id", UUID.class) : null,
                workspaceId, sourceCollectionId);
        var member = memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        if (sourceTeamId != null) {
            var team = teamRepository.findByIdAndWorkspaceIdForUpdate(sourceTeamId, workspaceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Time não encontrado"));
            if (member.getTeam() == null || !member.getTeam().getId().equals(team.getId())
                    || !team.getLeader().getId().equals(member.getId())) {
                throw new ForbiddenException("Somente o Líder atual do time de origem pode revogar");
            }
        } else if (!authorization.isOwner(userId, workspace) && member.getGlobalRole() != GlobalRole.ADMIN) {
            throw new ForbiddenException("Somente Owner ou Admin pode revogar publicação de coleção sem time");
        }
        var before = accessNotifications.snapshot(workspaceId);
        UUID destinationCollectionId = publication.getDestinationCollection().getId();
        publicationRepository.delete(publication);
        publicationRepository.flush();
        receivedProjection.refresh(workspaceId, destinationCollectionId);
        activityLog.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.CONTENT_PUBLICATION_REVOKED, ActivityResourceType.PUBLICATION, publicationId,
                java.util.Map.of("publicationId", publicationId, "sourceCollectionId", sourceCollectionId,
                        "destinationCollectionId", destinationCollectionId, "originalId", originalId,
                        "originalType", originalType.name()));
        var destinationTeam = teamRepository.findAllByWorkspaceIdOrderByNameAscIdAsc(workspaceId).stream()
                .filter(team -> team.getRootCollection().getId().equals(destinationCollectionId)).findFirst();
        var recipients = destinationTeam.map(team -> memberRepository.findAllByTeamId(team.getId()).stream()
                .map(teamMember -> teamMember.getUser().getId()).toList()).orElse(List.of());
        accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspaceId), recipients,
                new NotificationResourceReference(workspaceId, NotificationResourceReference.Type.COLLECTION,
                        destinationCollectionId));
    }

    @Transactional(readOnly = true)
    public PublicationConfiguration configuration(UUID userId, UUID workspaceId, UUID sourceCollectionId) {
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        var source = collectionRepository.findByIdAndWorkspaceId(sourceCollectionId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Coleção de origem não encontrada"));
        UUID sourceTeamId = jdbc.query("SELECT id FROM workspace_team WHERE workspace_id=? AND root_collection_id=?",
                resultSet -> resultSet.next() ? resultSet.getObject("id", UUID.class) : null,
                workspaceId, sourceCollectionId);
        var member = memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        boolean globalManager = authorization.isOwner(userId, workspace) || member.getGlobalRole() == GlobalRole.ADMIN;
        List<PublicationConfiguration.DestinationTeam> destinations = List.of();
        if (sourceTeamId == null) {
            if (!globalManager) throw new ResourceNotFoundException("Coleção de origem não encontrada");
        } else {
            var sourceTeam = teamRepository.findByIdAndWorkspaceId(sourceTeamId, workspaceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Time de origem não encontrado"));
            if (member.getTeam() == null || !member.getTeam().getId().equals(sourceTeamId)
                    || !sourceTeam.getLeader().getId().equals(member.getId())) {
                throw new ResourceNotFoundException("Coleção de origem não encontrada");
            }
            destinations = teamRepository.findAllByWorkspaceIdOrderByNameAscIdAsc(workspaceId).stream()
                    .filter(team -> !team.getId().equals(sourceTeamId))
                    .map(team -> new PublicationConfiguration.DestinationTeam(
                            team.getId(), team.getName(), team.getRootCollection().getId()))
                    .toList();
        }
        var publications = publicationRepository
                .findAllByWorkspaceIdAndSourceCollection(workspaceId, source.getId())
                .stream().map(this::response).toList();
        return new PublicationConfiguration(source.getId(), destinations, publications);
    }

    private void requireInsideSource(List<UUID> path, UUID sourceRootId) {
        if (path.isEmpty() || !path.get(0).equals(sourceRootId)) {
            throw new ResourceNotFoundException("Conteúdo não pertence ao time de origem");
        }
    }

    private String relativePath(List<String> path) {
        return path.size() <= 1 ? "" : String.join("/", path.subList(1, path.size()));
    }

    private PublicationResponse response(ContentPublication publication) {
        UUID originalId = publication.getOriginalType() == ContentPublicationType.ITEM
                ? publication.getOriginalItem().getId() : publication.getOriginalCollection().getId();
        return new PublicationResponse(publication.getId(), publication.getOriginalType(), originalId,
                publication.getSourceCollection().getId(), publication.getDestinationCollection().getId(),
                publication.getSourceTeamName(), publication.getCapturedPath(), publication.getCreatedAt());
    }

    private record ItemOrigin(UUID id, UUID collectionId) {}
}
