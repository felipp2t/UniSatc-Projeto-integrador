import { z } from 'zod'

export const workspaceMemberSchema = z.object({
  email: z.string().optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  roleId: z.string().min(1),
  roleName: z.string().min(1),
  userId: z.string().min(1),
})

export const workspaceMembersSchema = z.array(workspaceMemberSchema)
export type WorkspaceMemberResponse = z.infer<typeof workspaceMemberSchema>

export const workspaceRolesSchema = z.array(
  z.object({
    builtIn: z.boolean(),
    id: z.string().min(1),
    memberCount: z.number().int().nonnegative(),
    name: z.string().min(1),
  })
)
export type WorkspaceRoleResponse = z.infer<typeof workspaceRolesSchema>[number]
