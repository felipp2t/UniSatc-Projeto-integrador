import { useQuery } from '@tanstack/react-query'
import { workspaceApi } from '@/api/endpoints'
import { workspacesQueryKey } from '@/api/workspace-keys'

export function useCurrentWorkspace() {
  return useQuery({
    queryFn: async () => (await workspaceApi.list()).data,
    queryKey: workspacesQueryKey,
    select: (workspaces) => workspaces[0],
  })
}
