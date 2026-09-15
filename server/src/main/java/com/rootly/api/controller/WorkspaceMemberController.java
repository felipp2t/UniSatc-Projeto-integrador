package com.rootly.api.controller;

import com.rootly.api.controller.docs.WorkspaceMemberControllerDocs;
import com.rootly.api.dto.workspace.WorkspaceMemberResponse;
import com.rootly.api.service.WorkspaceMemberService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/workspaces/{workspaceId}/members")
@RequiredArgsConstructor
public class WorkspaceMemberController implements WorkspaceMemberControllerDocs {

    private final WorkspaceMemberService workspaceMemberService;

    @GetMapping
    @Override
    public List<WorkspaceMemberResponse> list(
            @AuthenticationPrincipal UUID userId, @PathVariable UUID workspaceId) {
        return workspaceMemberService.list(userId, workspaceId);
    }
}
