package com.rootly.api.service;

import com.rootly.api.dto.workspace.WorkspaceMemberResponse;
import com.rootly.api.exception.ResourceNotFoundException;
import com.rootly.api.mapper.WorkspaceMapper;
import com.rootly.api.repository.WorkspaceMemberRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceMemberService {

    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceMapper workspaceMapper;

    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponse> list(UUID userId, UUID workspaceId) {
        List<WorkspaceMemberResponse> members = workspaceMemberRepository
                .findAllVisibleToMember(workspaceId, userId).stream()
                .map(workspaceMapper::toResponse)
                .toList();

        if (members.isEmpty()) {
            throw new ResourceNotFoundException("Workspace não encontrado");
        }

        return members;
    }
}
