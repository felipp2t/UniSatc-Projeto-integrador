import { z } from 'zod'
import { apiClient } from './client'
import { permissionsSchema, type WorkspacePermission } from './permissions'

const replacePermissionsResponseSchema = z.object({
  permissions: permissionsSchema,
  roleId: z.string(),
  roleName: z.string(),
})

export type RolePermission = WorkspacePermission

export const rolePermissionsQueryKey = (workspaceId: string, roleId: string) =>
  ['workspace-role-permissions', workspaceId, roleId] as const

export const rolePermissionCatalogQueryKey = (workspaceId: string) =>
  ['workspace-role-permission-catalog', workspaceId] as const

export const rolePermissionsApi = {
  catalog: async (workspaceId: string) =>
    permissionsSchema.parse(
      (
        await apiClient.get<unknown>(
          `/workspaces/${workspaceId}/roles/permissions/catalog`
        )
      ).data
    ),
  get: async (workspaceId: string, roleId: string) =>
    permissionsSchema.parse(
      (
        await apiClient.get<unknown>(
          `/workspaces/${workspaceId}/roles/${roleId}/permissions`
        )
      ).data
    ),
  replace: async (
    workspaceId: string,
    roleId: string,
    permissions: RolePermission[]
  ) =>
    replacePermissionsResponseSchema.parse(
      (
        await apiClient.put<unknown>(
          `/workspaces/${workspaceId}/roles/${roleId}/permissions`,
          { permissions }
        )
      ).data
    ),
}
