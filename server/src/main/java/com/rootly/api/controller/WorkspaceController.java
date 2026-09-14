package com.rootly.api.controller;

import com.rootly.api.controller.docs.WorkspaceControllerDocs;
import com.rootly.api.dto.workspace.CreateWorkspaceRequest;
import com.rootly.api.dto.workspace.UpdateWorkspaceRequest;
import com.rootly.api.dto.workspace.WorkspaceResponse;
import com.rootly.api.service.WorkspaceService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/workspaces")
@RequiredArgsConstructor
public class WorkspaceController implements WorkspaceControllerDocs {

    private final WorkspaceService workspaceService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Override
    public WorkspaceResponse create(@AuthenticationPrincipal UUID userId,
                                    @Valid @RequestBody CreateWorkspaceRequest request) {
        return workspaceService.create(userId, request);
    }

    @GetMapping
    @Override
    public List<WorkspaceResponse> list(@AuthenticationPrincipal UUID userId) {
        return workspaceService.list(userId);
    }

    @GetMapping("/{workspaceId}")
    @Override
    public WorkspaceResponse get(@AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId) {
        return workspaceService.get(userId, workspaceId);
    }

    @PatchMapping("/{workspaceId}")
    @Override
    public WorkspaceResponse update(@AuthenticationPrincipal UUID userId,
                                    @PathVariable UUID workspaceId,
                                    @Valid @RequestBody UpdateWorkspaceRequest request) {
        return workspaceService.update(userId, workspaceId, request);
    }
}
