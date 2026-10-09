import { notFound } from '@tanstack/react-router'
import type { FileRouteTypes } from '@/route-tree.gen'

export interface PermissionRequirement {
  action: string
  resource: string
}

export interface PermissionChecker {
  can: (resource: string, action: string) => boolean
}

export const denyAllPermissions: PermissionChecker = {
  can: () => false,
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
