import { useMutation, useQueryClient } from '@tanstack/react-query'
import { workspaceApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import type { UpdateWorkspaceRequest, WorkspaceResponse } from '@/api/types'
import { workspacesQueryKey } from '@/api/workspace-keys'
import { appToast } from '@/components/ui/toast'

const UPDATE_WORKSPACE_STATUS_MESSAGES = {
  403: 'Somente o dono do workspace pode alterar estas configurações.',
  404: 'Workspace não encontrado ou vínculo inativo.',
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient()

  const updateWorkspace = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string
      values: UpdateWorkspaceRequest
    }) => workspaceApi.update(id, values),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<WorkspaceResponse[]>(
        workspacesQueryKey,
        (workspaces) =>
          workspaces?.map((item) => (item.id === data.id ? data : item))
      )
      appToast.success('Configurações do workspace salvas.')
    },
  })

  const error = updateWorkspace.error
    ? getApiErrorMessage(updateWorkspace.error, {
        fallback: 'Não foi possível salvar as configurações. Tente novamente.',
        statusMessages: UPDATE_WORKSPACE_STATUS_MESSAGES,
      })
    : undefined

  return {
    error,
    reset: updateWorkspace.reset,
    update: updateWorkspace.mutateAsync,
  }
}
