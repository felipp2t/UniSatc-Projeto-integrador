import { z } from 'zod'

const resources = [
  'workspace',
  'collection',
  'item',
  'secret',
  'member',
  'role',
  'activity',
  'team',
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

export const globalRoleSchema = z.enum(['ADMIN', 'MAINTAINER'])
export const workspaceRoleDefinitionSchema = z.object({
  code: z.enum(['OWNER', 'ADMIN', 'MAINTAINER', 'LEADER', 'MEMBER']),
  name: z.string(),
  permissions: permissionsSchema,
  scope: z.enum(['GLOBAL', 'COLLECTION']),
})
export const workspaceRoleDefinitionsSchema = z.array(
  workspaceRoleDefinitionSchema
)

export type WorkspacePermission = z.infer<typeof permissionSchema>

export const workspacePermissionsSchema = z.object({
  globalRole: globalRoleSchema.nullable(),
  isOwner: z.boolean(),
  isTeamLeader: z.boolean(),
  permissions: permissionsSchema,
  roleName: z.string().nullable(),
  teamId: z.string().uuid().nullable(),
})
export type WorkspacePermissionsResponse = z.infer<
  typeof workspacePermissionsSchema
>
