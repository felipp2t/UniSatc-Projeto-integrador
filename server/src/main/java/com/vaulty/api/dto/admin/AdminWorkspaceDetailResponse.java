package com.vaulty.api.dto.admin;

import com.vaulty.api.dto.workspace.WorkspaceMemberResponse;
import java.util.List;

public record AdminWorkspaceDetailResponse(
        AdminWorkspaceResponse workspace,
        List<WorkspaceMemberResponse> members) {}
