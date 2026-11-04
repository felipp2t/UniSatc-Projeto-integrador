import { queryOptions, useQuery } from '@tanstack/react-query'
import { workspaceApi } from '@/api/endpoints'
import { workspacesQueryKey } from '@/api/workspace-keys'
import { useAdminWorkspaceSelection } from './use-admin-workspace-selection'

export const workspacesQuery = queryOptions({
  queryFn: async () => (await workspaceApi.list()).data,
  queryKey: workspacesQueryKey,
})

export function useCurrentWorkspace() {
  const selectedWorkspaceId = useAdminWorkspaceSelection()
  return useQuery({
    ...workspacesQuery,
    select: (workspaces) =>
      workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
      workspaces[0],
  })
}
