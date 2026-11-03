import { queryOptions, useQuery } from '@tanstack/react-query'
import { workspaceApi } from '@/api/endpoints'
import {
  createPermissionChecker,
  workspacePermissionQueryKey,
} from '@/auth/permissions'

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
  const checker = createPermissionChecker(
    query.isError ? [] : (query.data?.permissions ?? []),
    !query.isError && query.data?.isOwner === true
  )
  return { ...query, can: checker.can }
}
