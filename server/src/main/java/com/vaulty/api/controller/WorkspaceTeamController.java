package com.vaulty.api.controller;

import com.vaulty.api.dto.team.AddTeamMemberRequest;
import com.vaulty.api.dto.team.ChangeTeamLeaderRequest;
import com.vaulty.api.dto.team.CreateWorkspaceTeamRequest;
import com.vaulty.api.dto.team.RenameWorkspaceTeamRequest;
import com.vaulty.api.dto.team.WorkspaceTeamMemberResponse;
import com.vaulty.api.dto.team.WorkspaceTeamResponse;
import com.vaulty.api.service.WorkspaceTeamService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/workspaces/{workspaceId}/teams")
@RequiredArgsConstructor
public class WorkspaceTeamController {

    private final WorkspaceTeamService teamService;

    @GetMapping
    public ResponseEntity<List<WorkspaceTeamResponse>> list(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId) {
        return ResponseEntity.ok(teamService.list(userId, workspaceId));
    }

    @GetMapping("/{teamId}")
    public ResponseEntity<WorkspaceTeamResponse> get(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId, @PathVariable UUID teamId) {
        return ResponseEntity.ok(teamService.get(userId, workspaceId, teamId));
    }

    @PostMapping
    public ResponseEntity<WorkspaceTeamResponse> create(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId,
            @Valid @RequestBody CreateWorkspaceTeamRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(teamService.create(userId, workspaceId, request));
    }

    @PutMapping("/{teamId}")
    public ResponseEntity<WorkspaceTeamResponse> rename(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId, @PathVariable UUID teamId,
            @Valid @RequestBody RenameWorkspaceTeamRequest request) {
        return ResponseEntity.ok(teamService.rename(userId, workspaceId, teamId, request));
    }

    @DeleteMapping("/{teamId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId, @PathVariable UUID teamId) {
        teamService.delete(userId, workspaceId, teamId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{teamId}/members")
    public ResponseEntity<List<WorkspaceTeamMemberResponse>> members(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId, @PathVariable UUID teamId) {
        return ResponseEntity.ok(teamService.members(userId, workspaceId, teamId));
    }

    @PostMapping("/{teamId}/members")
    public ResponseEntity<Void> addMember(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId, @PathVariable UUID teamId,
            @Valid @RequestBody AddTeamMemberRequest request) {
        teamService.addMember(userId, workspaceId, teamId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{teamId}/members/{memberId}")
    public ResponseEntity<Void> removeMember(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId, @PathVariable UUID teamId,
            @PathVariable UUID memberId) {
        teamService.removeMember(userId, workspaceId, teamId, memberId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{teamId}/leader")
    public ResponseEntity<Void> transferLeader(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId, @PathVariable UUID teamId,
            @Valid @RequestBody ChangeTeamLeaderRequest request) {
        teamService.transferLeader(userId, workspaceId, teamId, request);
        return ResponseEntity.noContent().build();
    }
}
