import { z } from 'zod'

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

export const permissionSchema = z.object({
  action: z.enum(actions),
  resource: z.enum(resources),
})

export const permissionsSchema = z.array(permissionSchema)

export type WorkspacePermission = z.infer<typeof permissionSchema>

export const workspacePermissionsSchema = z.object({
  isOwner: z.boolean(),
  permissions: permissionsSchema,
  roleId: z.string(),
  roleName: z.string(),
})
export type WorkspacePermissionsResponse = z.infer<
  typeof workspacePermissionsSchema
>
