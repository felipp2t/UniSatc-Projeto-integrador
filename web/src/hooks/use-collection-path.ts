import { useQuery } from '@tanstack/react-query'
import { collectionsApi } from '@/api/endpoints'

export function useCollectionPath(
  workspaceId: string,
  collectionId: string | undefined
) {
  return useQuery({
    enabled: Boolean(collectionId),
    queryFn: async () => {
      if (!collectionId) return []
      return (await collectionsApi.path(workspaceId, collectionId)).data
    },
    queryKey: ['collection-path', workspaceId, collectionId],
  })
}
