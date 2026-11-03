import { notFound } from '@tanstack/react-router'
import type { ItemType } from '@/api/types'
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
  permissions: EffectivePermission[],
  isOwner = false
): PermissionChecker {
  return {
    can: (resource, action) =>
      isOwner ||
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
  for (const match of matches) {
    const requirement = match.staticData.permission
    if (requirement && !checker.can(requirement.resource, requirement.action)) {
      throw notFound({ routeId: match.routeId })
    }
  }
}

export const workspacePermissionQueryKey = (
  workspaceId: string | undefined
) => ['workspace-permissions', workspaceId]

export function canAccessItem(
  checker: PermissionChecker,
  type: ItemType,
  action: 'read' | 'update' | 'delete'
) {
  return (
    checker.can('item', action) &&
    (type !== 'secret' ||
      (checker.can('secret', 'read') && checker.can('secret', action)))
  )
}
