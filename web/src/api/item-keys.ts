export const itemKeys = {
  all: (workspaceId: string) => ['items', workspaceId] as const,
  detail: (workspaceId: string, itemId: string) =>
    [...itemKeys.all(workspaceId), 'detail', itemId] as const,
  list: (
    workspaceId: string,
    {
      archived,
      collectionId,
      page,
    }: { archived: boolean; collectionId: string | undefined; page: number }
  ) =>
    [
      ...itemKeys.all(workspaceId),
      collectionId,
      page,
      ...(archived ? (['archived'] as const) : []),
    ] as const,
  // Fora de all(): salvar o item não refaz a leitura do segredo.
  secret: (workspaceId: string, itemId: string) =>
    ['item-secret', workspaceId, itemId] as const,
}
