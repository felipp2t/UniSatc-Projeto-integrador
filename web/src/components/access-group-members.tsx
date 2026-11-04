import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useId, useRef, useState } from 'react'
import { accessGroupApi, workspaceApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import { isForbiddenOrNotFound } from '@/api/http-status'
import type { AccessGroupResponse } from '@/api/types'
import {
  accessGroupMembersQueryKey,
  accessGroupsQueryKey,
  workspaceMembersQueryKey,
} from '@/api/workspace-keys'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Field, FieldLabel } from '@/components/ui/field'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { appToast } from '@/components/ui/toast'

export function AccessGroupMembers({
  group,
  workspaceId,
}: {
  group: AccessGroupResponse
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const pending = useRef({ active: false })
  const [candidateId, setCandidateId] = useState('')
  const labelId = useId()
  const members = useQuery({
    queryFn: async () =>
      (await accessGroupApi.listMembers(workspaceId, group.id)).data,
    queryKey: accessGroupMembersQueryKey(workspaceId, group.id),
  })
  const candidates = useQuery({
    queryFn: async () => (await workspaceApi.listMembers(workspaceId)).data,
    queryKey: workspaceMembersQueryKey(workspaceId),
  })
  const retryMembers = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: accessGroupsQueryKey(workspaceId),
    })
    await members.refetch()
  }, [members.refetch, queryClient, workspaceId])
  const retryCandidates = useCallback(async () => {
    await candidates.refetch()
  }, [candidates.refetch])
  const refreshMembers = async () => {
    await queryClient.invalidateQueries({
      queryKey: accessGroupMembersQueryKey(workspaceId, group.id),
    })
  }
  const addMember = useMutation({
    mutationFn: (membershipId: string) =>
      accessGroupApi.addMember(workspaceId, group.id, membershipId),
    onError: (cause: unknown) =>
      showMemberError(cause, 'Não foi possível adicionar o integrante.'),
    onSettled: () => {
      pending.current.active = false
    },
    onSuccess: async () => {
      await refreshMembers()
      setCandidateId('')
      appToast.success('Integrante adicionado ao grupo.')
    },
  })
  const removeMember = useMutation({
    mutationFn: (membershipId: string) =>
      accessGroupApi.removeMember(workspaceId, group.id, membershipId),
    onError: (cause: unknown) =>
      showMemberError(cause, 'Não foi possível remover o integrante.'),
    onSettled: () => {
      pending.current.active = false
    },
    onSuccess: async () => {
      await refreshMembers()
      appToast.success('Integrante removido do grupo.')
    },
  })
  const handleRemove = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      // biome-ignore lint/suspicious/noUnnecessaryConditions: The synchronous ref guard blocks duplicate clicks before React rerenders.
      if (pending.current.active) return
      pending.current.active = true
      removeMember.mutate(event.currentTarget.value)
    },
    [removeMember.mutate]
  )
  const handleAdd = useCallback(() => {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: The synchronous ref guard blocks duplicate clicks before React rerenders.
    if (pending.current.active || !candidateId) return
    pending.current.active = true
    addMember.mutate(candidateId)
  }, [addMember.mutate, candidateId])

  if (members.isPending) return <LoadingState label='Carregando integrantes…' />
  if (members.isError) {
    return (
      <ErrorState
        error={members.error}
        message={
          isForbiddenOrNotFound(members.error)
            ? 'Não foi possível acessar os integrantes. Confirme seu vínculo com o workspace.'
            : 'Não foi possível carregar os integrantes do grupo.'
        }
        onRetry={retryMembers}
      />
    )
  }

  const memberIds = new Set(
    members.data.map((member) => member.workspaceMemberId)
  )
  const availableMembers = (candidates.data ?? []).filter(
    (member) => !memberIds.has(member.id)
  )
  const actionsPending = addMember.isPending || removeMember.isPending
  const membershipError = candidates.isError
    ? isForbiddenOrNotFound(candidates.error)
      ? 'Não foi possível acessar os integrantes do workspace.'
      : 'Não foi possível carregar as opções de integrantes.'
    : undefined

  return (
    <div className='space-y-4'>
      {members.data.length === 0 ? (
        <EmptyState
          description='Adicione integrantes abaixo. Uma pessoa pode participar de vários grupos.'
          title='Este grupo ainda não tem integrantes'
          variant='compact'
        />
      ) : (
        <ul className='divide-y divide-border rounded-md border border-border'>
          {members.data.map((member) => (
            <li
              className='flex min-w-0 items-center gap-3 p-3'
              key={member.workspaceMemberId}
            >
              <div className='min-w-0 flex-1'>
                <p className='break-words font-medium text-sm'>{member.name}</p>
                {member.email ? (
                  <p className='break-all text-muted-foreground text-xs'>
                    {member.email}
                  </p>
                ) : null}
              </div>
              <Button
                aria-label={`Remover ${member.name} do grupo`}
                disabled={actionsPending}
                loading={
                  removeMember.isPending &&
                  removeMember.variables === member.workspaceMemberId
                }
                onClick={handleRemove}
                size='sm'
                value={member.workspaceMemberId}
                variant='outline'
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
      {candidates.isPending ? (
        <LoadingState label='Carregando opções de integrantes…' />
      ) : null}
      {membershipError ? (
        <ErrorState
          error={candidates.error}
          message={membershipError}
          onRetry={retryCandidates}
          variant='compact'
        />
      ) : null}
      {candidates.isPending || membershipError ? null : (
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end'>
          <Field className='min-w-0 flex-1'>
            <FieldLabel id={labelId}>Adicionar integrante</FieldLabel>
            <Select
              disabled={actionsPending || availableMembers.length === 0}
              onValueChange={setCandidateId}
              value={candidateId}
            >
              <SelectTrigger aria-labelledby={labelId}>
                <SelectValue
                  placeholder={
                    availableMembers.length
                      ? 'Selecione um integrante'
                      : 'Todos já fazem parte do grupo'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.email
                      ? `${member.name} — ${member.email}`
                      : member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            disabled={actionsPending || !candidateId}
            loading={addMember.isPending}
            onClick={handleAdd}
            type='button'
          >
            Adicionar
          </Button>
        </div>
      )}
    </div>
  )
}

function showMemberError(cause: unknown, fallback: string) {
  appToast.error(
    getApiErrorMessage(cause, {
      fallback,
      statusMessages: {
        403: 'Você não tem permissão para gerenciar grupos.',
        404: 'O workspace, grupo ou integrante não foi encontrado.',
        409: 'O vínculo do integrante com este grupo mudou. Atualize a lista e tente novamente.',
      },
    })
  )
}
