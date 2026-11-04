import { queryOptions, useQuery } from '@tanstack/react-query'
import { workspaceApi } from '@/api/endpoints'
import { workspacesQueryKey } from '@/api/workspace-keys'

export const workspacesQuery = queryOptions({
  queryFn: async () => (await workspaceApi.list()).data,
  queryKey: workspacesQueryKey,
})

export function useCurrentWorkspace() {
  return useQuery({ ...workspacesQuery, select: (workspaces) => workspaces[0] })
}
