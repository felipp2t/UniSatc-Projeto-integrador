import { PlusIcon } from '@phosphor-icons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { adminWorkspacesQueryKey } from '@/api/admin'
import { adminApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
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
import { Textarea } from '@/components/ui/textarea'
import { appToast } from '@/components/ui/toast'

const nameSchema = z
  .string()
  .trim()
  .min(3, 'O nome deve ter pelo menos 3 caracteres.')
  .max(100, 'O nome deve ter no máximo 100 caracteres.')

export function CreateWorkspaceDialog() {
  const queryClient = useQueryClient()
  const nameId = useId()
  const descriptionId = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState<string>()
  const [requestError, setRequestError] = useState<string>()
  const reset = useCallback(() => {
    setName('')
    setDescription('')
    setNameError(undefined)
    setRequestError(undefined)
  }, [])
  const createWorkspace = useMutation({
    mutationFn: adminApi.createWorkspace,
    onError: (error) => {
      setRequestError(
        getApiErrorMessage(error, {
          fallback: 'Não foi possível criar o workspace. Tente novamente.',
          statusMessages: {
            403: 'Apenas o administrador geral pode criar workspaces.',
          },
        })
      )
    },
    onSuccess: async () => {
      appToast.success('Workspace criado')
      setOpen(false)
      reset()
      await queryClient.invalidateQueries({ queryKey: adminWorkspacesQueryKey })
    },
  })
  const submitting = createWorkspace.isPending
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
      const result = nameSchema.safeParse(name)
      if (!result.success) {
        setNameError(result.error.issues[0]?.message)
        return
      }

      setNameError(undefined)
      setRequestError(undefined)
      createWorkspace.mutate({
        description: description.trim() || undefined,
        name: result.data,
      })
    },
    [createWorkspace.mutate, description, name]
  )
  const handleNameChange = useCallback((value: string) => {
    setName(value)
    setNameError(undefined)
    setRequestError(undefined)
  }, [])
  const handleCancel = useCallback(
    () => handleOpenChange(false),
    [handleOpenChange]
  )

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button className='cursor-pointer rounded-none' size='sm'>
          <PlusIcon aria-hidden='true' size={16} weight='bold' />
          Novo workspace
        </Button>
      </DialogTrigger>
      <DialogContent className='rounded-none p-7 shadow-none sm:max-w-[30rem]'>
        <DialogHeader>
          <DialogTitle className='text-[13px] tracking-[0.05em]'>
            Novo workspace
          </DialogTitle>
          <DialogDescription className='font-medium text-[10px]'>
            O workspace é criado com os papéis Owner e Member. Depois, convide o
            líder da equipe como proprietário.
          </DialogDescription>
        </DialogHeader>
        <form
          className='flex flex-col gap-4 pt-2'
          noValidate
          onSubmit={handleSubmit}
        >
          <Field invalid={Boolean(nameError)}>
            <FieldLabel htmlFor={nameId}>Nome</FieldLabel>
            <Input
              aria-describedby={nameError ? `${nameId}-error` : undefined}
              aria-invalid={Boolean(nameError)}
              className='rounded-none border-border bg-card shadow-none focus-visible:ring-0'
              disabled={submitting}
              id={nameId}
              maxLength={100}
              onValueChange={handleNameChange}
              required
              value={name}
            />
            <FieldError id={`${nameId}-error`}>{nameError}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor={descriptionId}>Descrição</FieldLabel>
            <Textarea
              className='rounded-none border-border bg-card shadow-none focus-visible:ring-0'
              disabled={submitting}
              id={descriptionId}
              maxLength={2000}
              onValueChange={setDescription}
              value={description}
            />
          </Field>
          {requestError ? (
            <p className='text-destructive text-sm' role='alert'>
              {requestError}
            </p>
          ) : null}
          <DialogFooter className='gap-2.5'>
            <Button
              className='cursor-pointer rounded-none'
              disabled={submitting}
              onClick={handleCancel}
              variant='outline'
            >
              Cancelar
            </Button>
            <Button
              className='cursor-pointer rounded-none'
              disabled={submitting}
              loading={submitting}
              type='submit'
            >
              Criar workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
