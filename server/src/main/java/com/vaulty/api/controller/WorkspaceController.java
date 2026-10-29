package com.vaulty.api.controller;

import com.vaulty.api.controller.docs.WorkspaceControllerDocs;
import com.vaulty.api.dto.activity.ActivityPageResponse;
import com.vaulty.api.dto.workspace.UpdateWorkspaceRequest;
import com.vaulty.api.dto.workspace.WorkspacePermissionsResponse;
import com.vaulty.api.dto.workspace.WorkspaceResponse;
import com.vaulty.api.service.WorkspaceActivityService;
import com.vaulty.api.service.WorkspaceContentAuthorization;
import com.vaulty.api.service.WorkspaceService;
import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/workspaces")
@RequiredArgsConstructor
public class WorkspaceController implements WorkspaceControllerDocs {

    private final WorkspaceService workspaceService;
    private final WorkspaceActivityService activityService;
    private final WorkspaceContentAuthorization authorization;

    @GetMapping("/{workspaceId}/me/permissions")
    @Override
    public WorkspacePermissionsResponse permissions(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId) {
        return authorization.permissions(userId, workspaceId);
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

    @PutMapping("/{workspaceId}")
    @Override
    public WorkspaceResponse update(@AuthenticationPrincipal UUID userId,
                                    @PathVariable UUID workspaceId,
                                    @Valid @RequestBody UpdateWorkspaceRequest request) {
        return workspaceService.update(userId, workspaceId, request);
    }

    @GetMapping("/{workspaceId}/activity")
    @Override
    public ActivityPageResponse activity(@AuthenticationPrincipal UUID userId,
                                         @PathVariable UUID workspaceId,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "20") int size,
                                         @RequestParam(required = false)
                                         @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
                                         @RequestParam(required = false)
                                         @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
                                         @RequestParam(required = false) UUID actorId,
                                         @RequestParam(required = false) String action,
                                         @RequestParam(required = false) String resourceType) {
        return activityService.list(userId, workspaceId, page, size, from, to, actorId, action, resourceType);
    }
}
