import { UserPlusIcon } from '@phosphor-icons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { adminWorkspacesQueryKey } from '@/api/admin'
import { adminApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Label } from '@/components/ui/label'
import { appToast } from '@/components/ui/toast'

const emailSchema = z.string().trim().pipe(z.email('Informe um e-mail válido.'))

interface AdminInviteDialogProps {
  workspaceId: string
  workspaceName: string
}

export function AdminInviteDialog({
  workspaceId,
  workspaceName,
}: AdminInviteDialogProps) {
  const queryClient = useQueryClient()
  const emailId = useId()
  const ownerId = useId()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [owner, setOwner] = useState(false)
  const [emailError, setEmailError] = useState<string>()
  const [requestError, setRequestError] = useState<string>()
  const reset = useCallback(() => {
    setEmail('')
    setOwner(false)
    setEmailError(undefined)
    setRequestError(undefined)
  }, [])
  const invite = useMutation({
    mutationFn: (request: { email: string; owner: boolean }) =>
      adminApi.invite(workspaceId, request),
    onError: (error) => {
      setRequestError(
        getApiErrorMessage(error, {
          fallback: 'Não foi possível criar o convite. Tente novamente.',
          statusMessages: {
            403: 'Apenas o administrador geral pode executar esta ação.',
            404: 'Workspace não encontrado.',
            409: 'Este e-mail já possui uma conta.',
          },
        })
      )
    },
    onSuccess: async () => {
      appToast.success('Convite criado; e-mail encaminhado para envio')
      setOpen(false)
      reset()
      await queryClient.invalidateQueries({ queryKey: adminWorkspacesQueryKey })
    },
  })
  const submitting = invite.isPending
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
      const result = emailSchema.safeParse(email)
      if (!result.success) {
        setEmailError(result.error.issues[0]?.message)
        return
      }

      setEmailError(undefined)
      setRequestError(undefined)
      invite.mutate({ email: result.data, owner })
    },
    [email, invite.mutate, owner]
  )
  const handleEmailChange = useCallback((value: string) => {
    setEmail(value)
    setEmailError(undefined)
    setRequestError(undefined)
  }, [])
  const handleOwnerChange = useCallback(
    (checked: boolean | 'indeterminate') => setOwner(checked === true),
    []
  )
  const handleCancel = useCallback(
    () => handleOpenChange(false),
    [handleOpenChange]
  )

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label={`Convidar para ${workspaceName}`}
          className='cursor-pointer rounded-none'
          size='sm'
          variant='outline'
        >
          <UserPlusIcon aria-hidden='true' size={16} weight='bold' />
          Convidar
        </Button>
      </DialogTrigger>
      <DialogContent className='rounded-none p-7 shadow-none sm:max-w-[30rem]'>
        <DialogHeader>
          <DialogTitle className='text-[13px] tracking-[0.05em]'>
            Convidar para {workspaceName}
          </DialogTitle>
          <DialogDescription className='font-medium text-[10px]'>
            Cada pessoa participa de um único workspace. Se já houver um convite
            pendente para este e-mail, ele será substituído.
          </DialogDescription>
        </DialogHeader>
        <form
          className='flex flex-col gap-4 pt-2'
          noValidate
          onSubmit={handleSubmit}
        >
          <Field invalid={Boolean(emailError)}>
            <FieldLabel htmlFor={emailId}>E-mail</FieldLabel>
            <Input
              aria-describedby={emailError ? `${emailId}-error` : undefined}
              aria-invalid={Boolean(emailError)}
              autoComplete='email'
              className='rounded-none border-border bg-card shadow-none focus-visible:ring-0'
              disabled={submitting}
              id={emailId}
              onValueChange={handleEmailChange}
              required
              type='email'
              value={email}
            />
            <FieldError id={`${emailId}-error`}>{emailError}</FieldError>
          </Field>
          <div className='flex items-center gap-2'>
            <Checkbox
              checked={owner}
              disabled={submitting}
              id={ownerId}
              onCheckedChange={handleOwnerChange}
            />
            <Label htmlFor={ownerId}>
              Entrar como proprietário (líder da equipe)
            </Label>
          </div>
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
              Criar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
