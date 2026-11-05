import { useQuery } from '@tanstack/react-query'
import { workspaceApi } from '@/api/endpoints'
import { isOwnerRole } from '@/api/member-permissions'
import { workspaceMembersQueryKey } from '@/api/workspace-keys'

export function useWorkspaceMembers(
  workspaceId: string | undefined,
  userId: string | undefined
) {
  const members = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return (await workspaceApi.listMembers(workspaceId)).data
    },
    queryKey: workspaceMembersQueryKey(workspaceId),
  })
  const currentUserRole = members.data?.find(
    (member) => member.userId === userId
  )?.roleName

  return {
    currentUserRole,
    isOwner: isOwnerRole(currentUserRole ?? undefined),
    members,
  }
}
