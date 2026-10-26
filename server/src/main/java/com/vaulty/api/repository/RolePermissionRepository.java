package com.vaulty.api.repository;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RolePermissionRepository extends JpaRepository<com.vaulty.api.entity.RolePermission, UUID> {

    @Query("""
            select count(permission) > 0 from RolePermission permission
            where permission.role.id = :roleId and permission.resource = :resource
              and permission.action in (:action, 'all')
            """)
    boolean allows(@Param("roleId") UUID roleId, @Param("resource") String resource,
                   @Param("action") String action);
}
