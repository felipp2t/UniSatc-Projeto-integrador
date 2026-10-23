import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { collectionKeys } from '@/api/collection-keys'
import { collectionsApi } from '@/api/endpoints'
import type { CollectionPageResponse } from '@/api/types'

interface CreateCollectionVariables {
  request: { name: string; parentId?: string }
  workspaceId: string
}

interface RenameCollectionVariables {
  collectionId: string
  name: string
  parentId: string | undefined
  workspaceId: string
}

interface RemoveCollectionVariables {
  collectionId: string
  parentId: string | undefined
  workspaceId: string
}

type CollectionSnapshot = [QueryKey, CollectionPageResponse | undefined][]

export function useCollectionMutations() {
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: ({ workspaceId, request }: CreateCollectionVariables) =>
      collectionsApi.create(workspaceId, request),
    onSettled: (_data, _error, { workspaceId, request }) =>
      queryClient.invalidateQueries({
        queryKey: collectionKeys.lists(workspaceId, request.parentId),
      }),
  })

  const rename = useMutation({
    mutationFn: ({
      collectionId,
      name,
      workspaceId,
    }: RenameCollectionVariables) =>
      collectionsApi.rename(workspaceId, collectionId, { name }),
    onError: (_error, _variables, context) => {
      restoreSnapshots(context?.snapshots)
    },
    onMutate: async ({
      collectionId,
      name,
      parentId,
      workspaceId,
    }: RenameCollectionVariables) => {
      const queryKey = collectionKeys.lists(workspaceId, parentId)
      await queryClient.cancelQueries({ queryKey })
      const snapshots = queryClient.getQueriesData<CollectionPageResponse>({
        queryKey,
      })

      for (const [key, page] of snapshots) {
        if (!page) continue
        queryClient.setQueryData<CollectionPageResponse>(key, {
          ...page,
          items: page.items.map((collection) =>
            collection.id === collectionId
              ? { ...collection, name }
              : collection
          ),
        })
      }

      return { snapshots }
    },
    onSettled: (_data, _error, { parentId, workspaceId }) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: collectionKeys.lists(workspaceId, parentId),
        }),
        queryClient.invalidateQueries({
          queryKey: collectionKeys.paths(workspaceId),
        }),
      ]),
  })

  const remove = useMutation({
    mutationFn: ({ collectionId, workspaceId }: RemoveCollectionVariables) =>
      collectionsApi.remove(workspaceId, collectionId),
    onError: (_error, _variables, context) => {
      restoreSnapshots(context?.snapshots)
    },
    onMutate: async ({
      collectionId,
      parentId,
      workspaceId,
    }: RemoveCollectionVariables) => {
      const queryKey = collectionKeys.lists(workspaceId, parentId)
      await queryClient.cancelQueries({ queryKey })
      const snapshots = queryClient.getQueriesData<CollectionPageResponse>({
        queryKey,
      })

      for (const [key, page] of snapshots) {
        if (!page) continue
        const totalItems = Math.max(0, page.totalItems - 1)
        queryClient.setQueryData<CollectionPageResponse>(key, {
          ...page,
          items: page.items.filter(
            (collection) => collection.id !== collectionId
          ),
          totalItems,
          totalPages: Math.ceil(totalItems / page.size),
        })
      }

      return { snapshots }
    },
    onSettled: (_data, _error, { parentId, workspaceId }) =>
      queryClient.invalidateQueries({
        queryKey: collectionKeys.lists(workspaceId, parentId),
      }),
    onSuccess: (_data, { collectionId, workspaceId }) => {
      queryClient.removeQueries({
        queryKey: collectionKeys.lists(workspaceId, collectionId),
      })
      queryClient.removeQueries({
        queryKey: collectionKeys.path(workspaceId, collectionId),
      })
    },
  })

  function restoreSnapshots(snapshots: CollectionSnapshot | undefined) {
    if (!snapshots) return
    for (const [queryKey, data] of snapshots) {
      if (data) queryClient.setQueryData(queryKey, data)
    }
  }

  return { create, remove, rename }
}
