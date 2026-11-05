export const workspacesQueryKey = ['workspaces'] as const
export const workspaceMembersQueryKey = (workspaceId: string | undefined) =>
  ['workspace-members', workspaceId] as const
export const workspaceRolesQueryKey = (workspaceId: string | undefined) =>
  ['workspace-roles', workspaceId] as const

export const workspacePermissionQueryKey = (workspaceId: string | undefined) =>
  ['workspace-permissions', workspaceId] as const
export const workspaceTeamsQueryKey = (workspaceId: string | undefined) =>
  ['workspace-teams', workspaceId] as const
export const workspaceTeamMembersQueryKey = (
  workspaceId: string | undefined,
  teamId: string | undefined
) => ['workspace-team-members', workspaceId, teamId] as const

export const publicationKeys = {
  all: (workspaceId: string | undefined) =>
    ['workspace-publications', workspaceId] as const,
  configuration: (
    workspaceId: string | undefined,
    sourceCollectionId: string | undefined
  ) =>
    [
      ...publicationKeys.all(workspaceId),
      'configuration',
      sourceCollectionId,
    ] as const,
}

export const receivedContentKeys = {
  all: (workspaceId: string | undefined) =>
    ['workspace-received', workspaceId] as const,
  attachment: (
    workspaceId: string | undefined,
    virtualId: string | undefined
  ) =>
    [...receivedContentKeys.all(workspaceId), 'attachment', virtualId] as const,
  detail: (workspaceId: string | undefined, virtualId: string | undefined) =>
    [...receivedContentKeys.all(workspaceId), 'detail', virtualId] as const,
  list: (
    workspaceId: string | undefined,
    params: { contentOnly?: boolean; page?: number; q?: string; size?: number }
  ) => [...receivedContentKeys.all(workspaceId), 'list', params] as const,
  path: (workspaceId: string | undefined, virtualId: string | undefined) =>
    [...receivedContentKeys.all(workspaceId), 'path', virtualId] as const,
  secret: (workspaceId: string | undefined, virtualId: string | undefined) =>
    [...receivedContentKeys.all(workspaceId), 'secret', virtualId] as const,
}
