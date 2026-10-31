import { notFound } from '@tanstack/react-router'
import type { FileRouteTypes } from '@/route-tree.gen'

export interface PermissionRequirement {
  action: PermissionAction
  resource: PermissionResource
}

export type PermissionAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'invite'
  | 'manage'
  | (string & {})
export type PermissionResource =
  | 'workspace'
  | 'collection'
  | 'item'
  | 'member'
  | 'role'
  | 'activity'
  | (string & {})
export interface EffectivePermission {
  action: PermissionAction | 'all'
  resource: PermissionResource
}

export interface PermissionChecker {
  can: (resource: PermissionResource, action: PermissionAction) => boolean
}

export const denyAllPermissions: PermissionChecker = {
  can: () => false,
}

export function createPermissionChecker(
  permissions: EffectivePermission[]
): PermissionChecker {
  return {
    can: (resource, action) =>
      permissions.some(
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
  const matchWithPermission = [...matches]
    .reverse()
    .find((match) => Boolean(match.staticData.permission))

  const requirement = matchWithPermission?.staticData.permission

  if (requirement && !checker.can(requirement.resource, requirement.action)) {
    throw notFound({ routeId: matchWithPermission.routeId })
  }
}

export const workspacePermissionQueryKey = (workspaceId: string) => [
  'workspaces',
  workspaceId,
  'permissions',
]
