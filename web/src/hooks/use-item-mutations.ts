import { useMutation, useQueryClient } from '@tanstack/react-query'
import { itemsApi, type UploadOptions } from '@/api/endpoints'
import { itemKeys } from '@/api/item-keys'
import type {
  UpdateAttachmentMetadataRequest,
  UpdateItemRequest,
} from '@/api/types'
import { receivedContentKeys } from '@/api/workspace-keys'

interface ItemVariables {
  itemId: string
  workspaceId: string
}

// onSettled: após 404/409/erro de rede o estado do item é desconhecido; relê o servidor.
function useItemMutation<Variables extends ItemVariables, Result>(
  mutationFn: (variables: Variables) => Promise<Result>
) {
  const queryClient = useQueryClient()
  return useMutation({
    // gcTime 0: o segredo em claro sai do MutationCache ao desmontar o diálogo.
    gcTime: 0,
    mutationFn,
    onSettled: (_data, _error, { workspaceId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) }),
        queryClient.invalidateQueries({
          queryKey: receivedContentKeys.all(workspaceId),
        }),
      ]),
  })
}

export function useUpdateItem() {
  return useItemMutation(
    ({
      itemId,
      request,
      workspaceId,
    }: ItemVariables & { request: UpdateItemRequest }) =>
      itemsApi.update(workspaceId, itemId, request)
  )
}

export function useUpdateAttachmentMetadata() {
  return useItemMutation(
    ({
      itemId,
      request,
      workspaceId,
    }: ItemVariables & { request: UpdateAttachmentMetadataRequest }) =>
      itemsApi.updateMetadata(workspaceId, itemId, request)
  )
}

export function useReplaceAttachment() {
  return useItemMutation(
    ({
      file,
      itemId,
      options,
      workspaceId,
    }: ItemVariables & { file: File; options?: Partial<UploadOptions> }) =>
      itemsApi.replaceAttachment(workspaceId, itemId, file, options)
  )
}

export function useArchiveItem() {
  return useItemMutation(({ itemId, workspaceId }: ItemVariables) =>
    itemsApi.archive(workspaceId, itemId)
  )
}

export function useRestoreItem() {
  return useItemMutation(({ itemId, workspaceId }: ItemVariables) =>
    itemsApi.restore(workspaceId, itemId)
  )
}

export function useDeleteItem() {
  return useItemMutation(({ itemId, workspaceId }: ItemVariables) =>
    itemsApi.remove(workspaceId, itemId)
  )
}
