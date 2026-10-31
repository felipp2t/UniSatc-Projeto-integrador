import { useForm, useSelector } from '@tanstack/react-form'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { authApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import {
  getApiErrorMessage,
  RATE_LIMITED_MESSAGE,
  SERVER_UNAVAILABLE_MESSAGE,
} from '@/api/get-api-error-message'
import {
  authButtonClassName,
  authErrorClassName,
  authLabelClassName,
  authLinkClassName,
  authSecretContainerClassName,
  authSecretInputClassName,
} from '@/components/auth-form-styles'
import { AuthStatus, BrandMark } from '@/components/auth-status'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { SecretInput } from '@/components/ui/secret-input'
import { appToast } from '@/components/ui/toast'

export const Route = createFileRoute('/redefinir-senha')({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const [rejectedToken, setRejectedToken] = useState<string>()
  const navigate = useNavigate({ from: '/redefinir-senha' })
  const startNewRequest = useCallback(
    () => navigate({ to: '/esqueci-senha' }),
    [navigate]
  )
  const rejectToken = useCallback(() => setRejectedToken(token), [token])
  if (!token?.trim() || rejectedToken === token) {
    return (
      <AuthStatus
        action={startNewRequest}
        actionLabel='Solicitar novo link'
        message='Este link não está disponível. Inicie uma nova solicitação de recuperação de senha.'
        title='Link indisponível'
      />
    )
  }

  return (
    <ResetPasswordForm
      key={token}
      onTokenRejected={rejectToken}
      token={token}
    />
  )
}

function ResetPasswordForm({
  onTokenRejected,
  token,
}: {
  onTokenRejected: () => void
  token: string
}) {
  const { session } = Route.useRouteContext()
  const navigate = useNavigate({ from: '/redefinir-senha' })
  const formId = useId()
  const [error, setError] = useState<string>()
  const form = useForm({
    defaultValues: { confirmPassword: '', newPassword: '' },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        await authApi.resetPassword({
          confirmPassword: value.confirmPassword,
          newPassword: value.newPassword,
          token,
        })
      } catch (cause) {
        const apiError = toApiError(cause)
        if (apiError.isUnauthorized) {
          onTokenRejected()
          return
        }
        setError(
          getApiErrorMessage(apiError, {
            fallback: 'Não foi possível redefinir a senha. Tente novamente.',
            serverError: SERVER_UNAVAILABLE_MESSAGE,
            statusMessages: {
              400: 'Confira os dados informados e tente novamente.',
              429: RATE_LIMITED_MESSAGE,
            },
          })
        )
        return
      }

      try {
        await session.logout()
      } catch {
        session.clearLocalSession()
      }
      appToast.success('Senha redefinida. Entre novamente com sua nova senha.')
      await navigate({
        replace: true,
        search: { redirect: undefined },
        to: '/login',
      })
    },
    validators: {
      onSubmit: z
        .object({
          confirmPassword: z.string(),
          newPassword: z
            .string()
            .min(8, 'Use pelo menos 8 caracteres.')
            .refine((password) => password.trim().length > 0, {
              message: 'A senha não pode conter apenas espaços.',
            }),
        })
        .refine((value) => value.newPassword === value.confirmPassword, {
          message: 'As senhas devem ser iguais.',
          path: ['confirmPassword'],
        }),
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
                Redefinir senha
              </h1>
              <p className='text-muted-foreground text-sm'>
                Escolha uma nova senha com pelo menos 8 caracteres.
              </p>
            </div>
            {(['newPassword', 'confirmPassword'] as const).map((name) => (
              <form.Field key={name} name={name}>
                {(field) => {
                  const errorId = `${formId}-${name}-error`
                  const invalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  const isNewPassword = name === 'newPassword'
                  const label = isNewPassword
                    ? 'Nova senha'
                    : 'Confirme a senha'
                  const placeholder = isNewPassword
                    ? 'Digite sua nova senha'
                    : 'Repita a nova senha'
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel
                        className={authLabelClassName}
                        htmlFor={`${formId}-${name}`}
                      >
                        {label}
                      </FieldLabel>
                      <SecretInput
                        aria-describedby={invalid ? errorId : undefined}
                        aria-invalid={invalid}
                        autoComplete='new-password'
                        className={authSecretInputClassName}
                        containerClassName={authSecretContainerClassName}
                        disabled={submitting}
                        id={`${formId}-${name}`}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onValueChange={field.handleChange}
                        placeholder={placeholder}
                        value={field.state.value}
                        visibilityLabel={
                          isNewPassword ? 'nova senha' : 'confirmação da senha'
                        }
                      />
                      <FieldError className={authErrorClassName} id={errorId}>
                        {field.state.meta.errors[0]?.message}
                      </FieldError>
                    </Field>
                  )
                }}
              </form.Field>
            ))}
            {error ? (
              <p className='text-destructive text-sm' role='alert'>
                {error}
              </p>
            ) : null}
            <Button
              className={authButtonClassName}
              disabled={!canSubmit || submitting}
              loading={submitting}
              type='submit'
            >
              Redefinir senha
            </Button>
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
