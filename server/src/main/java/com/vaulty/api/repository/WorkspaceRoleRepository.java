package com.vaulty.api.repository;

import com.vaulty.api.dto.role.RoleResponse;
import com.vaulty.api.entity.WorkspaceRole;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceRoleRepository extends JpaRepository<WorkspaceRole, UUID> {

    Optional<WorkspaceRole> findByWorkspaceIdAndName(UUID workspaceId, String name);

    Optional<WorkspaceRole> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select role from WorkspaceRole role where role.id = :roleId and role.workspace.id = :workspaceId")
    Optional<WorkspaceRole> findByIdAndWorkspaceIdForUpdate(
            @Param("roleId") UUID roleId, @Param("workspaceId") UUID workspaceId);

    @Query("""
            select new com.vaulty.api.dto.role.RoleResponse(role.id, role.name, count(member))
            from WorkspaceRole role
            left join WorkspaceMember member on member.role = role
            where role.workspace.id = :workspaceId
            group by role.id, role.name
            order by role.name asc, role.id asc
            """)
    List<RoleResponse> findAllWithMemberCount(@Param("workspaceId") UUID workspaceId);
}
