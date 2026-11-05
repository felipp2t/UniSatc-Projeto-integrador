import { notFound } from '@tanstack/react-router'
import { permissionSchema, type WorkspacePermission } from '@/api/permissions'
import type { FileRouteTypes } from '@/route-tree.gen'

export interface PermissionRequirement {
  action: PermissionAction
  resource: PermissionResource
}

export type PermissionAction = Exclude<WorkspacePermission['action'], 'all'>
export type PermissionResource = WorkspacePermission['resource']

export interface PermissionChecker {
  can: (resource: PermissionResource, action: PermissionAction) => boolean
}

export const permissionCatalog = {
  resources: [
    'workspace',
    'collection',
    'item',
    'secret',
    'member',
    'role',
    'activity',
    'team',
  ] as const,
  actions: [
    'read',
    'create',
    'update',
    'delete',
    'invite',
    'all',
    'manage',
  ] as const,
}

export const denyAllPermissions: PermissionChecker = {
  can: () => false,
}

export function createPermissionChecker(
  permissions: WorkspacePermission[],
  isOwner = false
): PermissionChecker {
  const validPermissions = permissions.filter(
    (permission) => permissionSchema.safeParse(permission).success
  )
  return {
    can: (resource, action) =>
      isOwner ||
      validPermissions.some(
        (permission) =>
          permission.resource === resource &&
          (permission.action === action || permission.action === 'all')
      ),
  }
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    permission?: PermissionRequirement
  }
}

interface RouteMatchWithPermission {
  routeId: FileRouteTypes['id']
  staticData: {
    permission?: PermissionRequirement
  }
}

export function enforceRoutePermission(
  matches: readonly RouteMatchWithPermission[],
  checker: PermissionChecker
) {
  for (const match of matches) {
    const requirement = match.staticData.permission
    if (requirement && !checker.can(requirement.resource, requirement.action)) {
      throw notFound({ routeId: match.routeId })
    }
  }
}
