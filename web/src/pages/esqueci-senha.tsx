import { useForm, useSelector } from '@tanstack/react-form'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { authApi } from '@/api/endpoints'
import {
  getApiErrorMessage,
  RATE_LIMITED_MESSAGE,
  SERVER_UNAVAILABLE_MESSAGE,
} from '@/api/get-api-error-message'
import {
  authButtonClassName,
  authErrorClassName,
  authInputClassName,
  authLabelClassName,
  authLinkClassName,
} from '@/components/auth-form-styles'
import { BrandMark } from '@/components/invite-status'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/esqueci-senha')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const formId = useId()
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      setError(undefined)
      setMessage(undefined)
      try {
        await authApi.forgotPassword({ email: value.email })
        setMessage(
          'Se houver uma conta com esse e-mail, você receberá orientações para redefinir a senha.'
        )
      } catch (cause) {
        setError(
          getApiErrorMessage(cause, {
            fallback:
              'Não foi possível solicitar a redefinição. Tente novamente.',
            serverError: SERVER_UNAVAILABLE_MESSAGE,
            statusMessages: {
              400: 'Confira o e-mail informado e tente novamente.',
              429: RATE_LIMITED_MESSAGE,
            },
          })
        )
      }
    },
    validators: {
      onSubmit: z.object({ email: z.email('Informe um e-mail válido.') }),
    },
  })
  const submitting = useSelector(form.store, (state) => state.isSubmitting)
  const canSubmit = useSelector(form.store, (state) => state.canSubmit)
  const submit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      form.handleSubmit().catch(() => undefined)
    },
    [form]
  )

  return (
    <main className='flex min-h-svh flex-col items-center justify-center bg-background p-6 md:p-10'>
      <section aria-labelledby={`${formId}-title`} className='w-full max-w-sm'>
        <form noValidate onSubmit={submit}>
          <FieldGroup className='gap-7'>
            <div className='flex flex-col items-center gap-2 text-center'>
              <BrandMark />
              <h1 className='font-bold text-xl' id={`${formId}-title`}>
                Recuperação de senha
              </h1>
              <p className='text-muted-foreground text-sm'>
                Informe seu e-mail para receber orientações de redefinição.
              </p>
            </div>
            <form.Field name='email'>
              {(field) => {
                const errorId = `${formId}-email-error`
                const invalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={invalid}>
                    <FieldLabel
                      className={authLabelClassName}
                      htmlFor={`${formId}-email`}
                    >
                      E-mail
                    </FieldLabel>
                    <Input
                      aria-describedby={invalid ? errorId : undefined}
                      aria-invalid={invalid}
                      autoComplete='email'
                      className={authInputClassName}
                      disabled={submitting || Boolean(message)}
                      id={`${formId}-email`}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      placeholder='seu.email@exemplo.com'
                      type='email'
                      value={field.state.value}
                    />
                    <FieldError className={authErrorClassName} id={errorId}>
                      {field.state.meta.errors[0]?.message}
                    </FieldError>
                  </Field>
                )
              }}
            </form.Field>
            <p
              aria-live='polite'
              className='text-muted-foreground text-sm'
              role='status'
            >
              {message}
            </p>
            {error ? (
              <p className='text-destructive text-sm' role='alert'>
                {error}
              </p>
            ) : null}
            {message ? null : (
              <Button
                className={authButtonClassName}
                disabled={!canSubmit || submitting}
                loading={submitting}
                type='submit'
              >
                Enviar orientações
              </Button>
            )}
            <Link
              className={authLinkClassName}
              search={{ redirect: undefined }}
              to='/login'
            >
              Voltar ao login
            </Link>
          </FieldGroup>
        </form>
      </section>
    </main>
  )
}
