package com.vaulty.api.service;

import com.vaulty.api.dto.role.RoleRequest;
import com.vaulty.api.dto.role.RoleResponse;
import com.vaulty.api.dto.workspace.WorkspacePermission;
import com.vaulty.api.entity.WorkspaceRole;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.PersistenceConstraints;
import com.vaulty.api.repository.WorkspaceMemberRepository;
import com.vaulty.api.repository.WorkspaceRoleRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceRoleService {

    private static final String DUPLICATE_NAME_CONSTRAINT = "uq_workspace_role_workspace_name";
    private static final String BUILT_IN_NAME_CONSTRAINT = "ck_workspace_role_builtin_names";
    private static final String MEMBER_ROLE_FK = "workspace_member_role_id_fkey";

    private final WorkspaceRoleRepository roleRepository;
    private final WorkspaceMemberRepository memberRepository;
    private final WorkspaceContentAuthorization authorization;
    private final ActivityLogService activityLogService;

    @Transactional(readOnly = true)
    public List<RoleResponse> list(UUID userId, UUID workspaceId) {
        authorization.requireOwner(userId, workspaceId);
        return roleRepository.findAllWithMemberCount(workspaceId);
    }

    @Transactional
    public RoleResponse create(UUID userId, UUID workspaceId, RoleRequest request) {
        var workspace = authorization.requireOwner(userId, workspaceId);
        var role = new WorkspaceRole();
        role.setWorkspace(workspace);
        role.setName(request.name());
        try {
            role = roleRepository.saveAndFlush(role);
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(
                    exception, DUPLICATE_NAME_CONSTRAINT, BUILT_IN_NAME_CONSTRAINT)) {
                throw new ConflictException("Já existe um papel com esse nome neste workspace");
            }
            throw exception;
        }
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.ROLE_CREATED, ActivityResourceType.ROLE, role.getId(),
                Map.of("roleId", role.getId(), "name", role.getName()));
        return new RoleResponse(role.getId(), role.getName(), 0);
    }

    @Transactional(readOnly = true)
    public List<WorkspacePermission> permissions(UUID userId, UUID workspaceId, UUID roleId) {
        authorization.requireOwner(userId, workspaceId);
        var role = roleRepository.findByIdAndWorkspaceId(roleId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Papel não encontrado"));
        return authorization.rolePermissions(role);
    }

    @Transactional
    public void delete(UUID userId, UUID workspaceId, UUID roleId) {
        authorization.requireOwnerForUpdate(userId, workspaceId);
        var role = roleRepository.findByIdAndWorkspaceIdForUpdate(roleId, workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Papel não encontrado"));
        if (role.isProtected()) {
            throw new ConflictException("Os papéis Dono e Membro não podem ser excluídos");
        }
        if (memberRepository.existsByRoleId(roleId)) {
            throw new ConflictException("Altere o papel dos membros antes de excluir este papel");
        }
        try {
            roleRepository.delete(role);
            roleRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            if (PersistenceConstraints.causedBy(exception, MEMBER_ROLE_FK)) {
                throw new ConflictException("Altere o papel dos membros antes de excluir este papel");
            }
            throw exception;
        }
        activityLogService.record(workspaceId, userId, ActivityActorContext.USER,
                ActivityAction.ROLE_DELETED, ActivityResourceType.ROLE, roleId,
                Map.of("roleId", roleId, "name", role.getName()));
    }
}
