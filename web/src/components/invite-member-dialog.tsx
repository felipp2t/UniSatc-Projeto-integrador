import { PlusIcon } from '@phosphor-icons/react'
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
        <Button>
          <PlusIcon aria-hidden='true' size={14} />
          Convidar membro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>
            O reenvio invalida o link anterior e reinicia a validade de 7 dias.
          </DialogDescription>
        </DialogHeader>
        <form className='space-y-4' noValidate onSubmit={handleSubmit}>
          <Field invalid={Boolean(emailError)}>
            <FieldLabel htmlFor={emailId}>E-mail</FieldLabel>
            <Input
              aria-describedby={emailError ? `${emailId}-error` : undefined}
              aria-invalid={Boolean(emailError)}
              autoComplete='email'
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
          <DialogFooter>
            <Button
              disabled={submitting}
              onClick={handleCancel}
              variant='outline'
            >
              Cancelar
            </Button>
            <Button disabled={submitting} loading={submitting} type='submit'>
              Criar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
