package com.vaulty.api.repository;

import com.vaulty.api.entity.RolePermission;
import java.util.UUID;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

public interface RolePermissionRepository extends JpaRepository<RolePermission, UUID> {

    @Query("select permission from RolePermission permission where permission.role.id = :roleId")
    List<RolePermission> findAllByRoleId(@Param("roleId") UUID roleId);

    @Modifying
    @Query("delete from RolePermission permission where permission.role.id = :roleId")
    void deleteAllByRoleId(@Param("roleId") UUID roleId);

    @Query("""
            select count(permission) > 0 from RolePermission permission
            where permission.role.id = :roleId and permission.resource = :resource
              and permission.action in (:action, 'all')
            """)
    boolean allows(@Param("roleId") UUID roleId, @Param("resource") String resource,
                   @Param("action") String action);
}
