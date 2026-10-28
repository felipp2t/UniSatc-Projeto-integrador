import { UserPlusIcon } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { inviteApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
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
import { appToast } from '@/components/ui/toast'

const emailSchema = z.string().trim().email('Informe um e-mail válido.')

export function InviteMemberDialog() {
  const queryClient = useQueryClient()
  const emailId = useId()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string>()
  const [requestError, setRequestError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  const reset = useCallback(() => {
    setEmail('')
    setEmailError(undefined)
    setRequestError(undefined)
  }, [])
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (submitting) return
      setOpen(nextOpen)
      if (!nextOpen) reset()
    },
    [reset, submitting]
  )
  const handleSubmit = useCallback(
    async (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      const result = emailSchema.safeParse(email)
      if (!result.success) {
        setEmailError(result.error.issues[0]?.message)
        return
      }

      setEmailError(undefined)
      setRequestError(undefined)
      setSubmitting(true)
      try {
        await inviteApi.create({ email: result.data })
        await queryClient.invalidateQueries({ queryKey: ['invites'] })
        appToast.success('Convite criado; e-mail encaminhado para envio')
        setOpen(false)
        reset()
      } catch (error) {
        const apiError = toApiError(error)
        setRequestError(
          apiError.status === 409
            ? 'Este e-mail já possui uma conta.'
            : apiError.status === 403
              ? 'Apenas o dono do workspace pode executar esta ação.'
              : apiError.isNetworkError
                ? 'Erro de conexão. Verifique sua internet e tente novamente.'
                : 'Não foi possível criar o convite. Tente novamente.'
        )
      } finally {
        setSubmitting(false)
      }
    },
    [email, queryClient, reset]
  )
  const handleEmailChange = useCallback((value: string) => {
    setEmail(value)
    setEmailError(undefined)
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
          <UserPlusIcon aria-hidden='true' size={16} weight='bold' />
          Convidar
        </Button>
      </DialogTrigger>
      <DialogContent className='rounded-none p-7 shadow-none sm:max-w-[30rem]'>
        <DialogHeader>
          <DialogTitle className='text-[13px] tracking-[0.05em]'>
            Convidar membro
          </DialogTitle>
          <DialogDescription className='font-medium text-[10px]'>
            O reenvio invalida o link anterior e reinicia a validade de 7 dias.
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
