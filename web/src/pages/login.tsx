import { FolderIcon } from '@phosphor-icons/react'
import { revalidateLogic, useForm, useSelector } from '@tanstack/react-form'
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouteContext,
} from '@tanstack/react-router'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { authApi } from '@/api/endpoints'
import {
  getApiErrorMessage,
  SERVER_UNAVAILABLE_MESSAGE,
} from '@/api/get-api-error-message'
import { sanitizeInternalRedirect } from '@/auth/redirect'
import {
  authButtonClassName,
  authErrorClassName,
  authInputClassName,
  authLabelClassName,
  authLinkClassName,
  authSecretContainerClassName,
  authSecretInputClassName,
} from '@/components/auth-form-styles'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SecretInput } from '@/components/ui/secret-input'

export const Route = createFileRoute('/login')({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: sanitizeInternalRedirect(search.redirect),
  }),
})

function LoginPage() {
  const { redirect: destination } = Route.useSearch()
  const { session } = useRouteContext({ from: '/login' })
  const navigate = useNavigate({ from: '/login' })
  const formId = useId()
  const [error, setError] = useState<string>()
  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        await authApi.login({
          email: value.email.trim(),
          password: value.password,
        })
      } catch (cause) {
        setError(
          getApiErrorMessage(cause, {
            fallback: 'E-mail ou senha inválidos.',
            serverError: SERVER_UNAVAILABLE_MESSAGE,
            statusMessages: {
              429: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
            },
          })
        )
        return
      }

      try {
        await session.initialize(true)
        if (session.status !== 'authenticated') {
          setError('Não foi possível confirmar sua sessão. Entre novamente.')
          return
        }

        await navigate({
          href: destination ?? '/',
          search: { redirect: undefined },
        })
      } catch {
        setError(
          'Login realizado, mas não foi possível continuar. Tente novamente.'
        )
      }
    },
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onSubmit: z.object({
        email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
        password: z
          .string()
          .min(6, 'A senha deve ter pelo menos 6 caracteres.'),
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
    <div className='flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10'>
      <div className='w-full max-w-sm'>
        <div className='flex flex-col gap-6'>
          <form
            aria-labelledby={`${formId}-title`}
            id='sign-in-form'
            noValidate
            onSubmit={submit}
          >
            <FieldGroup className='gap-7'>
              <div className='flex flex-col items-center gap-2 text-center'>
                <a
                  className='flex flex-col items-center gap-2 font-medium'
                  href='/'
                >
                  <div className='flex size-8 items-center justify-center rounded-md text-foreground'>
                    <FolderIcon aria-hidden='true' size={24} />
                  </div>
                  <span className='sr-only'>Vaulty</span>
                </a>
                <h1 className='font-bold text-xl' id={`${formId}-title`}>
                  Bem-vindo ao Vaulty
                </h1>
              </div>

              <div className='flex flex-col items-center gap-4'>
                <form.Field name='email'>
                  {(field) => {
                    const errorId = `${formId}-${field.name}-error`
                    const invalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={invalid}>
                        <FieldLabel
                          className={authLabelClassName}
                          htmlFor={field.name}
                        >
                          E-mail
                        </FieldLabel>
                        <Input
                          aria-describedby={invalid ? errorId : undefined}
                          aria-invalid={invalid}
                          autoComplete='off'
                          className={authInputClassName}
                          disabled={submitting}
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onValueChange={field.handleChange}
                          placeholder='seu.email@exemplo.com'
                          value={field.state.value}
                        />
                        <FieldError className={authErrorClassName} id={errorId}>
                          {field.state.meta.errors[0]?.message}
                        </FieldError>
                      </Field>
                    )
                  }}
                </form.Field>
                <form.Field name='password'>
                  {(field) => {
                    const errorId = `${formId}-${field.name}-error`
                    const invalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={invalid}>
                        <FieldLabel
                          className={authLabelClassName}
                          htmlFor={field.name}
                        >
                          Senha
                        </FieldLabel>
                        <SecretInput
                          aria-describedby={invalid ? errorId : undefined}
                          aria-invalid={invalid}
                          autoComplete='off'
                          className={authSecretInputClassName}
                          containerClassName={authSecretContainerClassName}
                          disabled={submitting}
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onValueChange={field.handleChange}
                          placeholder='123456'
                          value={field.state.value}
                          visibilityLabel='senha'
                        />
                        <FieldError className={authErrorClassName} id={errorId}>
                          {field.state.meta.errors[0]?.message ? (
                            <p>{field.state.meta.errors[0].message}</p>
                          ) : null}
                        </FieldError>
                        <Link className={authLinkClassName} to='/esqueci-senha'>
                          Esqueceu a senha?
                        </Link>
                      </Field>
                    )
                  }}
                </form.Field>
              </div>
              {error ? (
                <p className='text-destructive text-sm' role='alert'>
                  {error}
                </p>
              ) : null}
              <Field>
                <Button
                  className={authButtonClassName}
                  disabled={!canSubmit || submitting}
                  loading={submitting}
                  type='submit'
                >
                  {submitting ? 'Entrando...' : 'Entrar'}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </div>
      </div>
    </div>
  )
}
