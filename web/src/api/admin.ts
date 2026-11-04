export const adminWorkspacesQueryKey = ['admin', 'workspaces'] as const

export const adminWorkspaceQueryKey = (workspaceId: string) =>
  [...adminWorkspacesQueryKey, workspaceId] as const
