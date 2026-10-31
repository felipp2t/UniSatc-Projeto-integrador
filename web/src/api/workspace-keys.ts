export const workspacesQueryKey = ['workspaces'] as const
export const workspaceMembersQueryKey = (workspaceId: string | undefined) =>
  ['workspace-members', workspaceId] as const
export const workspaceRolesQueryKey = (workspaceId: string | undefined) =>
  ['workspace-roles', workspaceId] as const
