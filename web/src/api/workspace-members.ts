import { z } from 'zod'
import { workspaceRoleDefinitionSchema } from './permissions'

export const workspaceMemberSchema = z.object({
  email: z.string().optional(),
  globalRole: z.enum(['ADMIN', 'MAINTAINER']).nullable(),
  id: z.string().min(1),
  isTeamLeader: z.boolean(),
  name: z.string().min(1),
  roleName: z.string().min(1).nullable(),
  teamId: z.string().uuid().nullable(),
  userId: z.string().min(1),
})

export const workspaceMembersSchema = z.array(workspaceMemberSchema)
export type WorkspaceMemberResponse = z.infer<typeof workspaceMemberSchema>

export const workspaceRolesSchema = z.array(workspaceRoleDefinitionSchema)
export type WorkspaceRoleResponse = z.infer<typeof workspaceRolesSchema>[number]
