package com.vaulty.api.service;

import com.vaulty.api.dto.workspace.WorkspaceMemberResponse;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.mapper.WorkspaceMapper;
import com.vaulty.api.repository.WorkspaceMemberRepository;
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
        var workspaceMembers = workspaceMemberRepository.findAllVisibleToMember(workspaceId, userId);

        if (workspaceMembers.isEmpty()) {
            throw new ResourceNotFoundException("Workspace não encontrado");
        }

        boolean includeEmail = workspaceMembers.get(0).getWorkspace().getOwner().getId().equals(userId);

        return workspaceMembers.stream()
                .map(member -> workspaceMapper.toResponse(member, includeEmail))
                .toList();
    }
}
