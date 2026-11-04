import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { workspaceApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import type { WorkspaceRoleResponse } from '@/api/types'
import {
  workspaceMembersQueryKey,
  workspaceRolesQueryKey,
} from '@/api/workspace-keys'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const roleNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome do cargo.')
  .max(50, 'O nome do cargo deve ter até 50 caracteres.')

export function RenameRoleDialog({
  onOpenChange,
  open,
  role,
  workspaceId,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  role: WorkspaceRoleResponse
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const nameId = useId()
  const [name, setName] = useState(role.name)
  const [nameError, setNameError] = useState<string>()
  const renameRole = useMutation({
    mutationFn: (roleName: string) =>
      workspaceApi.renameRole(workspaceId, role.id, roleName),
    onSuccess: async () => {
      onOpenChange(false)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceMembersQueryKey(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceRolesQueryKey(workspaceId),
        }),
      ])
    },
  })
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (renameRole.isPending) return
      if (!nextOpen) {
        setName(role.name)
        setNameError(undefined)
        renameRole.reset()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, renameRole.isPending, renameRole.reset, role.name]
  )
  const handleNameChange = useCallback(
    (value: string) => {
      setName(value)
      setNameError(undefined)
      renameRole.reset()
    },
    [renameRole.reset]
  )
  const cancel = useCallback(() => handleOpenChange(false), [handleOpenChange])
  const handleSubmit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      const result = roleNameSchema.safeParse(name)
      if (!result.success) {
        setNameError(result.error.issues[0]?.message)
        return
      }
      if (result.data === role.name) {
        handleOpenChange(false)
        return
      }
      setNameError(undefined)
      renameRole.mutate(result.data)
    },
    [handleOpenChange, name, renameRole.mutate, role.name]
  )
  const requestError = renameRole.error
    ? getApiErrorMessage(renameRole.error, {
        fallback: 'Não foi possível renomear o cargo. Tente novamente.',
        statusMessages: {
          403: 'Apenas o dono do workspace pode executar esta ação.',
          404: 'Este cargo não está mais no workspace. Atualize a lista.',
          409: 'Já existe um cargo com esse nome neste workspace.',
        },
      })
    : undefined

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className='rounded-none p-7 shadow-none sm:max-w-[30rem]'>
        <DialogHeader>
          <DialogTitle className='text-[13px] tracking-[0.05em]'>
            Renomear cargo
          </DialogTitle>
          <DialogDescription className='font-medium text-[10px]'>
            Escolha um nome único com até 50 caracteres.
          </DialogDescription>
        </DialogHeader>
        <form
          className='flex flex-col gap-4 pt-2'
          noValidate
          onSubmit={handleSubmit}
        >
          <Field invalid={Boolean(nameError)}>
            <FieldLabel htmlFor={nameId}>Nome do cargo</FieldLabel>
            <Input
              aria-describedby={nameError ? `${nameId}-error` : undefined}
              aria-invalid={Boolean(nameError)}
              autoComplete='off'
              disabled={renameRole.isPending}
              id={nameId}
              maxLength={50}
              onValueChange={handleNameChange}
              required
              value={name}
            />
            <FieldError id={`${nameId}-error`}>{nameError}</FieldError>
          </Field>
          {requestError ? (
            <p className='text-destructive text-sm' role='alert'>
              {requestError}
            </p>
          ) : null}
          <DialogFooter className='gap-2.5'>
            <Button
              className='rounded-none'
              disabled={renameRole.isPending}
              onClick={cancel}
              variant='outline'
            >
              Cancelar
            </Button>
            <Button
              className='rounded-none'
              disabled={renameRole.isPending}
              loading={renameRole.isPending}
              type='submit'
            >
              Salvar nome
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
