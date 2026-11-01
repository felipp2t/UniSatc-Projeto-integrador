import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { flushSync } from 'react-dom'
import { workspaceApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import type { WorkspaceMemberResponse } from '@/api/types'
import {
  workspaceMembersQueryKey,
  workspacesQueryKey,
} from '@/api/workspace-keys'
import type { SessionService } from '@/auth/session'
import { appToast } from '@/components/ui/toast'

const REMOVE_MEMBER_STATUS_MESSAGES = {
  400: 'A confirmação do membro é inválida. Feche e abra a confirmação novamente.',
  403: 'Você não tem permissão para remover este membro.',
  404: 'Este membro não está mais no workspace. Atualize a lista.',
  409: 'O último dono do workspace não pode ser removido.',
}

interface UseRemoveMemberOptions {
  currentUserId: string | undefined
  session: SessionService
  workspaceId: string | undefined
}

async function endSessionAfterSelfRemoval({
  markSignedOut,
  navigate,
  queryClient,
  session,
}: {
  markSignedOut: () => void
  navigate: ReturnType<typeof useRouter>['navigate']
  queryClient: QueryClient
  session: SessionService
}) {
  await queryClient.cancelQueries()
  session.clearLocalSession()
  flushSync(markSignedOut)
  queryClient.clear()
  await navigate({
    replace: true,
    search: { redirect: undefined },
    to: '/login',
  })
}

export type MemberRemoval = ReturnType<typeof useRemoveMember>

export function useRemoveMember({
  currentUserId,
  session,
  workspaceId,
}: UseRemoveMemberOptions) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [signedOut, setSignedOut] = useState(false)
  const [memberToRemove, setMemberToRemove] =
    useState<WorkspaceMemberResponse | null>(null)

  const removeMember = useMutation({
    mutationFn: ({
      member,
      workspaceId: id,
    }: {
      member: WorkspaceMemberResponse
      workspaceId: string
    }) => workspaceApi.removeMember(id, member.id),
    onError: (_error, { workspaceId: id }) => {
      queryClient.invalidateQueries({
        queryKey: workspaceMembersQueryKey(id),
      })
    },
    onSuccess: async (_data, { member, workspaceId: id }) => {
      appToast.success(
        'Membro removido. A conta e o conteúdo permanecem preservados.'
      )
      if (member.userId === currentUserId) {
        await endSessionAfterSelfRemoval({
          markSignedOut: () => setSignedOut(true),
          navigate: router.navigate,
          queryClient,
          session,
        })
        return
      }
      setMemberToRemove(null)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceMembersQueryKey(id),
        }),
        queryClient.invalidateQueries({ queryKey: workspacesQueryKey }),
      ])
    },
  })

  const request = useCallback(
    (member: WorkspaceMemberResponse) => {
      if (removeMember.isPending) return
      removeMember.reset()
      setMemberToRemove(member)
    },
    [removeMember.isPending, removeMember.reset]
  )
  const cancel = useCallback(() => {
    if (removeMember.isPending) return
    setMemberToRemove(null)
    removeMember.reset()
  }, [removeMember.isPending, removeMember.reset])
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) cancel()
    },
    [cancel]
  )
  const confirm = useCallback(() => {
    if (!(memberToRemove && workspaceId) || removeMember.isPending) return
    removeMember.mutate({ member: memberToRemove, workspaceId })
  }, [memberToRemove, removeMember.isPending, removeMember.mutate, workspaceId])

  const error = removeMember.error
    ? getApiErrorMessage(removeMember.error, {
        fallback: 'Não foi possível remover o membro. Tente novamente.',
        statusMessages: REMOVE_MEMBER_STATUS_MESSAGES,
      })
    : undefined

  return {
    cancel,
    confirm,
    error,
    isPending: removeMember.isPending,
    memberToRemove,
    onOpenChange,
    request,
    signedOut,
  }
}
