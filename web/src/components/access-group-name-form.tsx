import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useId, useRef, useState } from 'react'
import { accessGroupApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import type { AccessGroupResponse } from '@/api/types'
import { accessGroupsQueryKey } from '@/api/workspace-keys'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { appToast } from '@/components/ui/toast'

export function AccessGroupNameForm({
  group,
  onCancel,
  onSaved,
  workspaceId,
}: {
  group?: AccessGroupResponse
  onCancel?: () => void
  onSaved?: (group: AccessGroupResponse) => void
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const pending = useRef({ active: false })
  const errorId = useId()
  const [name, setName] = useState(group?.name ?? '')
  const [error, setError] = useState<string>()
  const mutation = useMutation({
    mutationFn: (value: string) =>
      group
        ? accessGroupApi.rename(workspaceId, group.id, value)
        : accessGroupApi.create(workspaceId, value),
    onError: (cause: unknown) => {
      appToast.error(
        getApiErrorMessage(cause, {
          fallback: 'Não foi possível salvar o grupo.',
          statusMessages: {
            403: 'Você não tem permissão para gerenciar grupos.',
            404: 'O workspace ou grupo não foi encontrado.',
            409: 'Já existe um grupo com esse nome.',
          },
        })
      )
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: accessGroupsQueryKey(workspaceId),
      })
      appToast.success(group ? 'Grupo renomeado.' : 'Grupo criado.')
      if (!group) setName('')
      setError(undefined)
      onSaved?.(response.data)
    },
  })
  const submit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      // biome-ignore lint/suspicious/noUnnecessaryConditions: The synchronous ref guard blocks duplicate submits before React rerenders.
      if (pending.current.active) return
      const value = name.trim()
      if (!value) return setError('Informe um nome para o grupo.')
      if (value.length > 50)
        return setError('O nome deve ter no máximo 50 caracteres.')
      pending.current.active = true
      mutation.mutate(value, {
        onSettled: () => {
          pending.current.active = false
        },
      })
    },
    [mutation, name]
  )
  const updateName = useCallback((value: string) => {
    setName(value)
    setError(undefined)
  }, [])

  return (
    <form
      className='flex flex-col gap-2 sm:flex-row sm:items-end'
      noValidate
      onSubmit={submit}
    >
      <Field className='min-w-0 flex-1' invalid={Boolean(error)}>
        <FieldLabel
          htmlFor={
            group ? `rename-access-group-${group.id}` : 'new-access-group'
          }
        >
          {group ? 'Nome do grupo' : 'Novo grupo'}
        </FieldLabel>
        <Input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error) || undefined}
          id={group ? `rename-access-group-${group.id}` : 'new-access-group'}
          maxLength={50}
          onValueChange={updateName}
          value={name}
        />
        <FieldError
          errors={error ? [{ message: error }] : undefined}
          id={errorId}
        />
      </Field>
      <div className='flex gap-2'>
        <Button
          disabled={mutation.isPending}
          loading={mutation.isPending}
          type='submit'
        >
          {group ? 'Salvar' : 'Criar grupo'}
        </Button>
        {group && onCancel ? (
          <Button
            disabled={mutation.isPending}
            onClick={onCancel}
            type='button'
            variant='outline'
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  )
}
