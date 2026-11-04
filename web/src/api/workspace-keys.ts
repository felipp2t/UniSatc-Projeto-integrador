export const workspacesQueryKey = ['workspaces'] as const
export const workspaceMembersQueryKey = (workspaceId: string | undefined) =>
  ['workspace-members', workspaceId] as const
export const workspaceRolesQueryKey = (workspaceId: string | undefined) =>
  ['workspace-roles', workspaceId] as const

export const workspacePermissionQueryKey = (workspaceId: string | undefined) =>
  ['workspace-permissions', workspaceId] as const
export const accessGroupsQueryKey = (workspaceId: string | undefined) =>
  ['workspace-access-groups', workspaceId] as const
export const accessGroupMembersQueryKey = (
  workspaceId: string | undefined,
  groupId: string | undefined
) => ['workspace-access-group-members', workspaceId, groupId] as const
