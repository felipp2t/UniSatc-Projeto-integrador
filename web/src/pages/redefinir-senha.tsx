import { useForm, useSelector } from '@tanstack/react-form'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { cn } from 'cn'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { authApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import {
  authButtonClassName,
  authErrorClassName,
  authLabelClassName,
  authLinkClassName,
  authSecretContainerClassName,
  authSecretInputClassName,
} from '@/components/auth-form-styles'
import { BrandMark } from '@/components/invite-status'
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
  const { session } = Route.useRouteContext()
  const navigate = useNavigate({ from: '/redefinir-senha' })
  const formId = useId()
  const [error, setError] = useState<string>()
  const [unavailable, setUnavailable] = useState(!token)
  const form = useForm({
    defaultValues: { confirmPassword: '', newPassword: '' },
    onSubmit: async ({ value }) => {
      if (!token) {
        setUnavailable(true)
        return
      }
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
          setUnavailable(true)
          return
        }
        setError(
          apiError.isRateLimited
            ? 'Muitas tentativas. Aguarde um pouco e tente novamente.'
            : 'Não foi possível redefinir a senha agora. Verifique sua conexão e tente novamente.'
        )
        return
      }

      session.handleSessionExpired()
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
          newPassword: z.string().min(8, 'Use pelo menos 8 caracteres.'),
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

  if (unavailable) {
    return (
      <main className='flex min-h-svh flex-col items-center justify-center bg-background p-6 md:p-10'>
        <section
          aria-labelledby={`${formId}-title`}
          className='flex w-full max-w-sm flex-col items-center gap-4 text-center'
        >
          <BrandMark />
          <h1 className='font-bold text-xl' id={`${formId}-title`}>
            Link indisponível
          </h1>
          <p className='text-muted-foreground text-sm'>
            Este link não está disponível. Inicie uma nova solicitação de
            recuperação de senha.
          </p>
          <Link
            className={cn(
              authButtonClassName,
              'inline-flex h-9 w-full items-center justify-center bg-primary px-4 py-2 font-mono text-primary-foreground text-xs uppercase'
            )}
            to='/esqueci-senha'
          >
            Solicitar novo link
          </Link>
        </section>
      </main>
    )
  }

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
