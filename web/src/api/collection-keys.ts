export const collectionKeys = {
  all: ['collections'] as const,
  disabledPath: (workspaceId: string) =>
    ['collection-path-disabled', workspaceId] as const,
  list: (workspaceId: string, parentId: string | undefined, page: number) =>
    [...collectionKeys.lists(workspaceId, parentId), page] as const,
  lists: (workspaceId: string, parentId: string | undefined) =>
    [...collectionKeys.workspace(workspaceId), parentId] as const,
  path: (workspaceId: string, collectionId: string) =>
    [...collectionKeys.paths(workspaceId), collectionId] as const,
  paths: (workspaceId: string) => ['collection-path', workspaceId] as const,
  workspace: (workspaceId: string) =>
    [...collectionKeys.all, workspaceId] as const,
}
