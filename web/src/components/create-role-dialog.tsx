import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { workspaceApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import { workspaceRolesQueryKey } from '@/api/workspace-keys'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const roleNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome do cargo.')
  .max(50, 'O nome do cargo deve ter até 50 caracteres.')

interface CreateRoleDialogProps {
  children?: ReactNode
  workspaceId: string
}

export function CreateRoleDialog({
  children,
  workspaceId,
}: CreateRoleDialogProps) {
  const queryClient = useQueryClient()
  const nameId = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string>()
  const [requestError, setRequestError] = useState<string>()

  const reset = useCallback(() => {
    setName('')
    setNameError(undefined)
    setRequestError(undefined)
  }, [])

  const createRole = useMutation({
    mutationFn: (roleName: string) =>
      workspaceApi.createRole(workspaceId, roleName),
    onError: (error) => {
      setRequestError(
        getApiErrorMessage(error, {
          fallback: 'Não foi possível criar o cargo. Tente novamente.',
          statusMessages: {
            403: 'Apenas o dono do workspace pode executar esta ação.',
            409: 'Já existe um cargo com esse nome neste workspace.',
          },
        })
      )
    },
    onSuccess: async () => {
      setOpen(false)
      reset()
      await queryClient.invalidateQueries({
        queryKey: workspaceRolesQueryKey(workspaceId),
      })
    },
  })

  const submitting = createRole.isPending
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (submitting) return
      setOpen(nextOpen)
      if (!nextOpen) reset()
    },
    [reset, submitting]
  )
  const handleSubmit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      const result = roleNameSchema.safeParse(name)
      if (!result.success) {
        setNameError(result.error.issues[0]?.message)
        return
      }

      setNameError(undefined)
      setRequestError(undefined)
      createRole.mutate(result.data)
    },
    [createRole.mutate, name]
  )
  const handleNameChange = useCallback((value: string) => {
    setName(value)
    setNameError(undefined)
    setRequestError(undefined)
  }, [])
  const cancel = useCallback(() => handleOpenChange(false), [handleOpenChange])

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        {children ?? <Button className='rounded-none'>Criar cargo</Button>}
      </DialogTrigger>
      <DialogContent className='rounded-none p-7 shadow-none sm:max-w-[30rem]'>
        <DialogHeader>
          <DialogTitle className='text-[13px] tracking-[0.05em]'>
            Criar cargo
          </DialogTitle>
          <DialogDescription className='font-medium text-[10px]'>
            O novo cargo começa sem permissões. Você poderá configurá-las
            depois.
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
              disabled={submitting}
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
              disabled={submitting}
              onClick={cancel}
              variant='outline'
            >
              Cancelar
            </Button>
            <Button
              className='rounded-none'
              disabled={submitting}
              loading={submitting}
              type='submit'
            >
              Criar cargo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
