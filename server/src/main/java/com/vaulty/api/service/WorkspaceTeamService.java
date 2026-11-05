package com.vaulty.api.service;

import com.vaulty.api.dto.notification.NotificationResourceReference;
import com.vaulty.api.dto.team.AddTeamMemberRequest;
import com.vaulty.api.dto.team.ChangeTeamLeaderRequest;
import com.vaulty.api.dto.team.CreateWorkspaceTeamRequest;
import com.vaulty.api.dto.team.RenameWorkspaceTeamRequest;
import com.vaulty.api.dto.team.WorkspaceTeamMemberResponse;
import com.vaulty.api.dto.team.WorkspaceTeamResponse;
import com.vaulty.api.entity.WorkspaceCollection;
import com.vaulty.api.entity.WorkspaceMember;
import com.vaulty.api.entity.WorkspaceTeam;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.enums.GlobalRole;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ForbiddenException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.WorkspaceCollectionRepository;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceTeamRepository;
import com.vaulty.api.repository.PersistenceConstraints;
import jakarta.persistence.EntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceTeamService {

    private static final String TEAM_NAME_CONSTRAINT = "uq_workspace_team_workspace_name";

    private final WorkspaceTeamRepository teamRepository;
    private final WorkspaceMemberRepository memberRepository;
    private final WorkspaceCollectionRepository collectionRepository;
    private final WorkspaceContentAuthorization authorization;
    private final WorkspaceAccessNotifications accessNotifications;
    private final ActivityLogService activityLog;
    private final EntityManager entityManager;

    private static final String COLLECTION_NAME_CONSTRAINT = "uq_collection_workspace_parent_name";

    @Transactional(readOnly = true)
    public List<WorkspaceTeamResponse> list(UUID userId, UUID workspaceId) {
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        var member = memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId).orElseThrow();
        boolean global = authorization.isOwner(userId, workspace) || member.getGlobalRole() == GlobalRole.ADMIN;
        return teamRepository.findAllByWorkspaceIdOrderByNameAscIdAsc(workspaceId).stream()
                .filter(team -> global || (member.getTeam() != null && member.getTeam().getId().equals(team.getId())))
                .map(team -> response(team, memberRepository.findAllByTeamId(team.getId()).size()))
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkspaceTeamResponse get(UUID userId, UUID workspaceId, UUID teamId) {
        var team = team(teamId, workspaceId, false);
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        var member = memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId).orElseThrow();
        if (!authorization.isOwner(userId, workspace) && member.getGlobalRole() != GlobalRole.ADMIN
                && (member.getTeam() == null || !member.getTeam().getId().equals(teamId))) {
            throw new ResourceNotFoundException("Time não encontrado");
        }
        return response(team, memberRepository.findAllByTeamId(teamId).size());
    }

    @Transactional
    public WorkspaceTeamResponse create(UUID userId, UUID workspaceId, CreateWorkspaceTeamRequest request) {
        requireGlobalManager(userId, workspaceId, "create");
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        requireGlobalManager(userId, workspaceId, "create");
        var leader = member(request.leaderMemberId(), workspaceId);
        ensureEligible(leader, workspaceId);
        WorkspaceCollection root;
        if (request.rootCollectionId() == null) {
            root = new WorkspaceCollection();
            root.setWorkspace(workspace);
            root.setName(request.name());
            root.setId(UUID.randomUUID());
            try {
                root = collectionRepository.saveAndFlush(root);
            } catch (DataIntegrityViolationException exception) {
                if (PersistenceConstraints.causedBy(exception, COLLECTION_NAME_CONSTRAINT)) {
                    throw new ConflictException("Já existe uma coleção raiz com esse nome; reutilize-a ou escolha outro nome");
                }
                throw exception;
            }
        } else {
            root = collectionRepository.findByIdAndWorkspaceId(request.rootCollectionId(), workspaceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Coleção não encontrada"));
            if (root.getParent() != null || teamRepository.existsByWorkspaceIdAndRootCollectionId(workspaceId, root.getId())) {
                throw new ConflictException("A coleção deve ser raiz e não estar vinculada a outro time");
            }
        }
        var before = accessNotifications.snapshot(workspaceId);
        var team = new WorkspaceTeam();
        team.setWorkspace(workspace);
        team.setName(request.name());
        team.setRootCollection(root);
        team.setLeader(leader);
        team.setId(UUID.randomUUID());
        try {
            team = teamRepository.saveAndFlush(team);
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, TEAM_NAME_CONSTRAINT)) {
                throw new ConflictException("Já existe um time com esse nome neste workspace");
            }
            throw exception;
        }
        leader.setTeam(team);
        leader.setRole(null);
        memberRepository.saveAndFlush(leader);
        record(userId, workspaceId, ActivityAction.TEAM_CREATED, team, Map.of("teamId", team.getId(), "name", team.getName(), "rootCollectionId", root.getId()));
        changed(before, workspaceId, root.getId(), List.of(leader.getUser().getId()));
        return response(team, 1);
    }

    @Transactional
    public WorkspaceTeamResponse rename(UUID userId, UUID workspaceId, UUID teamId, RenameWorkspaceTeamRequest request) {
        requireGlobalManager(userId, workspaceId, "update");
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        requireGlobalManager(userId, workspaceId, "update");
        var team = team(teamId, workspaceId, true);
        String old = team.getName();
        team.setName(request.name());
        try {
            teamRepository.saveAndFlush(team);
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, TEAM_NAME_CONSTRAINT)) {
                throw new ConflictException("Já existe um time com esse nome neste workspace");
            }
            throw exception;
        }
        record(userId, workspaceId, ActivityAction.TEAM_RENAMED, team, Map.of("teamId", teamId, "previousName", old, "name", request.name()));
        return response(team, memberRepository.findAllByTeamId(teamId).size());
    }

    @Transactional
    public void delete(UUID userId, UUID workspaceId, UUID teamId) {
        requireGlobalManager(userId, workspaceId, "delete");
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        requireGlobalManager(userId, workspaceId, "delete");
        var team = team(teamId, workspaceId, true);
        var before = accessNotifications.snapshot(workspaceId);
        UUID rootId = team.getRootCollection().getId();
        var affected = memberRepository.findAllByTeamId(teamId).stream().map(m -> m.getUser().getId()).toList();
        teamRepository.delete(team);
        teamRepository.flush();
        record(userId, workspaceId, ActivityAction.TEAM_DELETED, team, Map.of("teamId", teamId, "name", team.getName(), "rootCollectionId", rootId));
        changed(before, workspaceId, rootId, affected);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceTeamMemberResponse> members(UUID userId, UUID workspaceId, UUID teamId) {
        var team = team(teamId, workspaceId, false);
        requireTeamManager(userId, workspaceId, team);
        UUID leaderId = team.getLeader().getId();
        return memberRepository.findAllByTeamId(teamId).stream()
                .map(member -> memberResponse(member, leaderId.equals(member.getId())))
                .toList();
    }

    @Transactional
    public void addMember(UUID userId, UUID workspaceId, UUID teamId, AddTeamMemberRequest request) {
        requireTeamManager(userId, workspaceId, team(teamId, workspaceId, false));
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        var team = team(teamId, workspaceId, true);
        requireTeamManager(userId, workspaceId, team);
        var member = member(request.workspaceMemberId(), workspaceId);
        if (member.getGlobalRole() != null || authorization.isOwner(member.getUser().getId(), team.getWorkspace())) {
            throw new ConflictException("Membros com papel global não podem pertencer a um time");
        }
        if (isLeader(member) && (member.getTeam() == null || !member.getTeam().getId().equals(teamId))) {
            throw new ConflictException("Transfira a liderança do time antes de mover o membro");
        }
        if (member.getTeam() != null && member.getTeam().getId().equals(teamId)) return;
        if (member.getTeam() != null && !isGlobalManager(userId, workspaceId)) {
            throw new ForbiddenException("Somente Owner ou Admin pode mover membros entre times");
        }
        var before = accessNotifications.snapshot(workspaceId);
        UUID oldTeam = member.getTeam() == null ? null : member.getTeam().getId();
        member.setTeam(team);
        member.setRole(null);
        memberRepository.saveAndFlush(member);
        record(userId, workspaceId, ActivityAction.TEAM_MEMBER_ADDED, team, Map.of("teamId", teamId, "workspaceMemberId", member.getId()));
        changed(before, workspaceId, team.getRootCollection().getId(), List.of(member.getUser().getId()));
        if (oldTeam != null) activityLog.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.TEAM_MEMBER_REMOVED, ActivityResourceType.TEAM, oldTeam,
                Map.of("teamId", oldTeam, "workspaceMemberId", member.getId()));
    }

    @Transactional
    public void removeMember(UUID userId, UUID workspaceId, UUID teamId, UUID memberId) {
        requireTeamManager(userId, workspaceId, team(teamId, workspaceId, false));
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        var team = team(teamId, workspaceId, true);
        requireTeamManager(userId, workspaceId, team);
        var member = member(memberId, workspaceId);
        if (member.getTeam() == null || !member.getTeam().getId().equals(teamId)) throw new ResourceNotFoundException("Membro do time não encontrado");
        if (isLeader(member)) throw new ConflictException("Transfira a liderança do time antes de remover o membro");
        var before = accessNotifications.snapshot(workspaceId);
        member.setTeam(null);
        memberRepository.saveAndFlush(member);
        record(userId, workspaceId, ActivityAction.TEAM_MEMBER_REMOVED, team, Map.of("teamId", teamId, "workspaceMemberId", memberId));
        changed(before, workspaceId, team.getRootCollection().getId(), List.of(member.getUser().getId()));
    }

    @Transactional
    public void transferLeader(UUID userId, UUID workspaceId, UUID teamId, ChangeTeamLeaderRequest request) {
        requireTransferLeader(userId, workspaceId, team(teamId, workspaceId, false));
        accessNotifications.lockWorkspace(workspaceId);
        entityManager.clear();
        var team = team(teamId, workspaceId, true);
        requireTransferLeader(userId, workspaceId, team);
        var successor = member(request.workspaceMemberId(), workspaceId);
        if (successor.getTeam() == null || !successor.getTeam().getId().equals(teamId) || successor.getGlobalRole() != null) throw new ConflictException("O novo líder deve ser membro do time");
        var before = accessNotifications.snapshot(workspaceId);
        var previousLeader = team.getLeader();
        UUID oldId = previousLeader.getId();
        team.setLeader(successor);
        teamRepository.saveAndFlush(team);
        record(userId, workspaceId, ActivityAction.TEAM_LEADER_CHANGED, team, Map.of("teamId", teamId, "previousLeaderMemberId", oldId, "leaderMemberId", successor.getId()));
        changed(before, workspaceId, team.getRootCollection().getId(), List.of(previousLeader.getUser().getId(), successor.getUser().getId()));
    }

    private void requireGlobalManager(UUID userId, UUID workspaceId, String action) {
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        if (authorization.isOwner(userId, workspace)) return;
        var member = memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        if (member.getGlobalRole() != GlobalRole.ADMIN) throw new ForbiddenException("Permissão insuficiente");
    }

    private boolean isGlobalManager(UUID userId, UUID workspaceId) {
        var workspace = authorization.requireWorkspace(userId, workspaceId);
        var member = memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId).orElseThrow();
        return authorization.isOwner(userId, workspace) || member.getGlobalRole() == GlobalRole.ADMIN;
    }

    private void requireTeamManager(UUID userId, UUID workspaceId, WorkspaceTeam team) {
        if (isGlobalManager(userId, workspaceId)) return;
        authorization.require(userId, team.getWorkspace(), "team", "manage");
        var actor = memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId).orElseThrow();
        if (!team.getLeader().getId().equals(actor.getId()) || actor.getTeam() == null || !actor.getTeam().getId().equals(team.getId())) throw new ForbiddenException("Líder só pode gerir o próprio time");
    }

    private void requireTransferLeader(UUID userId, UUID workspaceId, WorkspaceTeam team) {
        if (isGlobalManager(userId, workspaceId)) return;
        var actor = memberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace não encontrado"));
        if (team.getLeader().getId().equals(actor.getId()) && actor.getTeam() != null
                && actor.getTeam().getId().equals(team.getId())) return;
        throw new ForbiddenException("Permissão insuficiente");
    }

    private WorkspaceTeam team(UUID teamId, UUID workspaceId, boolean lock) {
        var team = (lock ? teamRepository.findByIdAndWorkspaceIdForUpdate(teamId, workspaceId)
                : teamRepository.findWithDetails(workspaceId, teamId))
                .orElseThrow(() -> new ResourceNotFoundException("Time não encontrado"));
        team.getRootCollection().getName();
        team.getLeader().getUser().getName();
        return team;
    }

    private WorkspaceMember member(UUID memberId, UUID workspaceId) {
        return memberRepository.findWithTeamByIdAndWorkspaceId(memberId, workspaceId).orElseThrow(() -> new ResourceNotFoundException("Membro não encontrado"));
    }

    private void ensureEligible(WorkspaceMember member, UUID workspaceId) {
        if (member.getGlobalRole() != null || member.getTeam() != null || authorization.isOwner(member.getUser().getId(), member.getWorkspace())) throw new ConflictException("O líder deve ser um membro sem papel global ou time");
    }

    private boolean isLeader(WorkspaceMember member) {
        return member.getTeam() != null && teamRepository.existsByIdAndLeader_Id(member.getTeam().getId(), member.getId());
    }

    private void changed(Map<UUID, java.util.Set<String>> before, UUID workspaceId, UUID rootId, List<UUID> users) {
        accessNotifications.notifyChanged(before, accessNotifications.snapshotAfterChange(workspaceId), users,
                new NotificationResourceReference(workspaceId, NotificationResourceReference.Type.COLLECTION, rootId));
    }

    private void record(UUID actor, UUID workspaceId, ActivityAction action, WorkspaceTeam team, Map<String, ?> snapshot) {
        activityLog.record(workspaceId, actor, ActivityActorContext.USER, action, ActivityResourceType.TEAM,
                team == null ? (UUID) snapshot.get("teamId") : team.getId(), snapshot);
    }

    private WorkspaceTeamResponse response(WorkspaceTeam team, long count) {
        return new WorkspaceTeamResponse(team.getId(), team.getName(), team.getRootCollection().getId(), team.getRootCollection().getName(), team.getLeader().getId(), team.getLeader().getUser().getName(), count);
    }

    private WorkspaceTeamMemberResponse memberResponse(WorkspaceMember member) {
        return memberResponse(member, isLeader(member));
    }

    private WorkspaceTeamMemberResponse memberResponse(WorkspaceMember member, boolean leader) {
        String role = member.getGlobalRole() != null ? member.getGlobalRole().displayName()
                : leader ? "Leader" : "Member";
        return new WorkspaceTeamMemberResponse(member.getId(), member.getUser().getId(), member.getUser().getName(), role);
    }
}
