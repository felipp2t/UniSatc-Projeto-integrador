import { useQuery } from '@tanstack/react-query'
import { collectionsApi, workspaceTeamsApi } from '@/api/endpoints'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'

export function usePublicationManagementAccess(
  workspaceId: string,
  collectionId: string | undefined
) {
  const permissions = useWorkspacePermissions(workspaceId)
  const canManageOrphans = permissions.isOwner || permissions.isAdmin
  const path = useQuery({
    enabled: Boolean(collectionId && canManageOrphans && !permissions.isLeader),
    queryFn: async () => {
      if (!collectionId) throw new Error('Coleção indisponível.')
      return (await collectionsApi.path(workspaceId, collectionId)).data
    },
    queryKey: ['publication-source-path', workspaceId, collectionId],
  })
  const teams = useQuery({
    enabled: Boolean(canManageOrphans && path.data?.[0]?.id),
    queryFn: async () => (await workspaceTeamsApi.list(workspaceId)).data,
    queryKey: ['workspace-teams', workspaceId],
  })
  const rootCollectionId = path.data?.[0]?.id
  const canRevokeOrphan = Boolean(
    canManageOrphans &&
      rootCollectionId &&
      teams.data &&
      !teams.data.some((team) => team.rootCollectionId === rootCollectionId)
  )
  return permissions.isLeader || canRevokeOrphan
}
