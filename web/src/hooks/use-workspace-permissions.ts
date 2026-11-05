import { queryOptions, useQuery } from '@tanstack/react-query'
import { workspaceApi } from '@/api/endpoints'
import { workspacePermissionQueryKey } from '@/api/workspace-keys'
import { createPermissionChecker, denyAllPermissions } from '@/auth/permissions'

export function workspacePermissionsQuery(workspaceId: string | undefined) {
  return queryOptions({
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return (await workspaceApi.permissions(workspaceId)).data
    },
    queryKey: workspacePermissionQueryKey(workspaceId),
    staleTime: 30_000,
  })
}

export function useWorkspacePermissions(workspaceId: string | undefined) {
  const query = useQuery(workspacePermissionsQuery(workspaceId))
  const checker =
    query.isError || !query.data
      ? denyAllPermissions
      : createPermissionChecker(query.data.permissions, query.data.isOwner)
  return { ...query, can: checker.can, isOwner: query.data?.isOwner ?? false }
}
