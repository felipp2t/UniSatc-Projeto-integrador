import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { workspaceApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import { OWNER_ROLE } from '@/api/member-permissions'
import type {
  WorkspaceMemberResponse,
  WorkspaceRoleResponse,
} from '@/api/types'
import { workspaceMembersQueryKey } from '@/api/workspace-keys'
import { appToast } from '@/components/ui/toast'

interface PendingRoleChange {
  member: WorkspaceMemberResponse
  roleId: string
  roleName: string
}

interface UseChangeMemberRoleOptions {
  currentUserId: string | undefined
  roles: WorkspaceRoleResponse[] | undefined
  workspaceId: string | undefined
}

export type MemberRoleChange = ReturnType<typeof useChangeMemberRole>

export function useChangeMemberRole({
  currentUserId,
  roles,
  workspaceId,
}: UseChangeMemberRoleOptions) {
  const queryClient = useQueryClient()
  const [pendingRoleChange, setPendingRoleChange] =
    useState<PendingRoleChange | null>(null)
  const changeRole = useMutation({
    mutationFn: ({
      memberId,
      roleId,
    }: {
      memberId: string
      roleId: string
    }) => {
      if (!workspaceId) throw new Error('Workspace indisponível.')
      return workspaceApi.changeMemberRole(workspaceId, memberId, roleId)
    },
    onError: (error) =>
      appToast.error(
        getApiErrorMessage(error, {
          fallback: 'Não foi possível alterar o cargo.',
          statusMessages: {
            409: 'O servidor recusou a alteração para proteger o último dono do workspace.',
          },
        })
      ),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: workspaceMembersQueryKey(workspaceId),
      }),
    onSuccess: () => appToast.success('Cargo alterado com sucesso.'),
  })

  const requestRoleChange = useCallback(
    (member: WorkspaceMemberResponse, roleId: string) => {
      const roleName = roles?.find((role) => role.id === roleId)?.name
      if (roleName) setPendingRoleChange({ member, roleId, roleName })
    },
    [roles]
  )
  const cancel = useCallback(() => {
    setPendingRoleChange(null)
  }, [])
  const onOpenChange = useCallback((open: boolean) => {
    if (!open) setPendingRoleChange(null)
  }, [])
  const confirm = useCallback(() => {
    if (!pendingRoleChange) return
    changeRole.mutate({
      memberId: pendingRoleChange.member.id,
      roleId: pendingRoleChange.roleId,
    })
    setPendingRoleChange(null)
  }, [changeRole.mutate, pendingRoleChange])

  const losesOwnManagement =
    pendingRoleChange !== null &&
    currentUserId !== undefined &&
    pendingRoleChange.member.userId === currentUserId &&
    pendingRoleChange.roleName !== OWNER_ROLE

  return {
    cancel,
    confirm,
    isChangingRole: changeRole.isPending,
    losesOwnManagement,
    onOpenChange,
    pendingRoleChange,
    requestRoleChange,
  }
}
