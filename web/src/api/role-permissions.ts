import { z } from 'zod'
import { apiClient } from './client'

const resources = [
  'workspace',
  'collection',
  'item',
  'secret',
  'member',
  'role',
  'activity',
  'group',
  'sharing',
] as const

const actions = [
  'read',
  'create',
  'update',
  'delete',
  'invite',
  'all',
  'manage',
] as const

const permissionSchema = z.object({
  action: z.enum(actions),
  resource: z.enum(resources),
})

const permissionsSchema = z.array(permissionSchema)

const replacePermissionsResponseSchema = z.object({
  permissions: permissionsSchema,
  roleId: z.string(),
  roleName: z.string(),
})

export type RolePermission = z.infer<typeof permissionSchema>

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
