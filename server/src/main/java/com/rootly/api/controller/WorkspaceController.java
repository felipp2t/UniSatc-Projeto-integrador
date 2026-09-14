package com.rootly.api.controller;

import com.rootly.api.dto.workspace.CreateWorkspaceRequest;
import com.rootly.api.dto.workspace.CreateWorkspaceResponse;
import com.rootly.api.service.WorkspaceService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/workspaces")
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    public WorkspaceController(WorkspaceService workspaceService) {
        this.workspaceService = workspaceService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CreateWorkspaceResponse create(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody CreateWorkspaceRequest request) {
        return new CreateWorkspaceResponse(workspaceService.create(userId, request));
    }
}
