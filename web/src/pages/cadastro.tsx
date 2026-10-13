import { FolderIcon } from '@phosphor-icons/react'
import { revalidateLogic, useForm, useSelector } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useId, useState } from 'react'
import { z } from 'zod'
import { authApi, inviteApi } from '@/api/endpoints'
import { type ApiError, toApiError } from '@/api/errors'
import type { InviteValidationResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { OfflineState } from '@/components/ui/offline-state'
import { SecretInput } from '@/components/ui/secret-input'

export const Route = createFileRoute('/cadastro')({
  component: InviteRegistrationPage,
  head: () => ({ meta: [{ title: 'Aceitar convite | Vaulty' }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === 'string' ? search.email : undefined,
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
})

interface ValidationResult {
  data: InviteValidationResponse
  receivedAt: number
}

const inviteValidationQueryKey = (
  email: string | undefined,
  token: string | undefined
) => ['invite-validation', email, token] as const

function InviteRegistrationPage() {
  const { email, token } = Route.useSearch()
  const { queryClient, session } = Route.useRouteContext()
  const navigate = useNavigate({ from: '/cadastro' })
  const hasInviteParameters = isUsableInviteInput(email, token)
  const validationQuery = useQuery({
    enabled: hasInviteParameters,
    queryFn: async (): Promise<ValidationResult> => {
      if (!(email && token)) {
        throw new Error('Parâmetros do convite ausentes.')
      }

      const { data } = await inviteApi.validate({ email, token })
      return { data, receivedAt: performance.now() }
    },
    queryKey: inviteValidationQueryKey(email, token),
  })
  const retryValidation = useCallback(
    () => validationQuery.refetch(),
    [validationQuery.refetch]
  )

  const handleRegistered = useCallback(async () => {
    await session.initialize(true)
    if (session.status !== 'authenticated') {
      throw new Error('Não foi possível confirmar sua sessão.')
    }

    queryClient.removeQueries({
      exact: true,
      queryKey: inviteValidationQueryKey(email, token),
    })
    await navigate({ replace: true, to: '/' })
  }, [email, navigate, queryClient, session, token])
  const handleGoToLogin = useCallback(
    () =>
      navigate({
        replace: true,
        search: { redirect: undefined },
        to: '/login',
      }),
    [navigate]
  )

  if (!hasInviteParameters) {
    return (
      <InviteStatus message={unavailableMessage} title='Convite indisponível' />
    )
  }

  if (validationQuery.fetchStatus === 'paused' && !validationQuery.data) {
    return <OfflineState />
  }

  if (validationQuery.isPending) {
    return (
      <InviteStatus
        message='Estamos conferindo se o convite ainda pode ser usado.'
        title='Validando convite'
      />
    )
  }

  if (validationQuery.isError) {
    const error = toApiError(validationQuery.error)
    if (error.status === 404) {
      return (
        <InviteStatus
          message={unavailableMessage}
          title='Convite indisponível'
        />
      )
    }

    if (error.isRateLimited) {
      return (
        <InviteStatus
          message='Muitas tentativas. Aguarde um minuto e tente abrir novamente o link do convite.'
          title='Não foi possível validar agora'
        />
      )
    }

    return <InviteRetryStatus onRetry={retryValidation} />
  }

  const validation = validationQuery.data
  if (!validation) {
    return (
      <InviteStatus
        message='Estamos conferindo se o convite ainda pode ser usado.'
        title='Validando convite'
      />
    )
  }

  const elapsedSeconds = Math.floor(
    (performance.now() - validation.receivedAt) / 1000
  )
  const remainingSeconds = Math.max(
    0,
    validation.data.remainingSeconds - elapsedSeconds
  )

  if (remainingSeconds <= 0) {
    return (
      <InviteStatus message={unavailableMessage} title='Convite indisponível' />
    )
  }

  return (
    <InviteRegistrationForm
      email={validation.data.email}
      onGoToLogin={handleGoToLogin}
      onRegistered={handleRegistered}
      remainingSeconds={remainingSeconds}
      token={token ?? ''}
    />
  )
}

function InviteRetryStatus({ onRetry }: { onRetry: () => void }) {
  return (
    <main className='flex min-h-svh items-center justify-center bg-background p-6'>
      <section
        aria-labelledby='invite-retry-title'
        className='flex w-full max-w-sm flex-col items-center gap-6 text-center'
      >
        <BrandMark />
        <h1 className='font-bold font-display text-2xl' id='invite-retry-title'>
          Falha temporária
        </h1>
        <ErrorState
          message='Não foi possível validar o convite. Verifique sua conexão e tente novamente.'
          onRetry={onRetry}
        />
      </section>
    </main>
  )
}

function isUsableInviteInput(
  email: string | undefined,
  token: string | undefined
) {
  return Boolean(
    email && z.email().safeParse(email).success && token && token.length > 0
  )
}

const unavailableMessage =
  'Este convite não está disponível. Peça ao dono do workspace que envie outro convite.'

interface InviteStatusProps {
  action?: () => void
  actionLabel?: string
  message: string
  title: string
}

function InviteStatus({
  action,
  actionLabel,
  message,
  title,
}: InviteStatusProps) {
  return (
    <main className='flex min-h-svh items-center justify-center bg-background p-6'>
      <section
        aria-labelledby='invite-status-title'
        className='flex w-full max-w-sm flex-col items-center gap-6 text-center'
      >
        <BrandMark />
        <div className='flex flex-col gap-2'>
          <h1
            className='font-bold font-display text-2xl'
            id='invite-status-title'
          >
            {title}
          </h1>
          <p className='text-muted-foreground text-sm'>{message}</p>
        </div>
        {action && actionLabel ? (
          <Button onClick={action} type='button'>
            {actionLabel}
          </Button>
        ) : null}
      </section>
    </main>
  )
}

function BrandMark() {
  return (
    <div
      aria-label='Vaulty'
      className='flex size-10 items-center justify-center rounded-md text-foreground'
      role='img'
    >
      <FolderIcon aria-hidden='true' size={28} />
    </div>
  )
}

const registrationSchema = z
  .object({
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
    name: z
      .string()
      .trim()
      .min(3, 'O nome deve ter pelo menos 3 caracteres.')
      .max(255, 'O nome deve ter no máximo 255 caracteres.'),
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
  })
  .refine(({ confirmPassword, password }) => confirmPassword === password, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })

interface InviteRegistrationFormProps {
  email: string
  onGoToLogin: () => void
  onRegistered: () => Promise<void>
  remainingSeconds: number
  token: string
}

function InviteRegistrationForm({
  email,
  onGoToLogin,
  onRegistered,
  remainingSeconds: initialRemainingSeconds,
  token,
}: InviteRegistrationFormProps) {
  const formId = useId()
  const [requestError, setRequestError] = useState<string>()
  const [completionError, setCompletionError] = useState<string>()
  const [inviteUnavailable, setInviteUnavailable] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(
    initialRemainingSeconds
  )
  const form = useForm({
    defaultValues: { confirmPassword: '', name: '', password: '' },
    onSubmit: async ({ value }) => {
      setRequestError(undefined)
      setCompletionError(undefined)

      try {
        await authApi.register({ email, token, ...value })
      } catch (cause) {
        const error = toApiError(cause)
        if (error.status === 404 || error.status === 409) {
          setInviteUnavailable(true)
          return
        }

        setRequestError(getRegistrationError(error))
        return
      }

      try {
        await onRegistered()
      } catch {
        setCompletionError(
          'Seu cadastro foi concluído, mas não foi possível confirmar sua sessão. Tente entrar novamente.'
        )
      }
    },
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: { onDynamic: registrationSchema },
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

  useEffect(() => {
    const startedAt = performance.now()
    const timer = window.setInterval(() => {
      const elapsedSeconds = Math.floor((performance.now() - startedAt) / 1000)
      setRemainingSeconds(Math.max(0, initialRemainingSeconds - elapsedSeconds))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [initialRemainingSeconds])

  if (remainingSeconds === 0) {
    return (
      <InviteStatus message={unavailableMessage} title='Convite indisponível' />
    )
  }

  if (inviteUnavailable) {
    return (
      <InviteStatus message={unavailableMessage} title='Convite indisponível' />
    )
  }

  if (completionError) {
    return (
      <InviteStatus
        action={onGoToLogin}
        actionLabel='Ir para o login'
        message={completionError}
        title='Cadastro concluído'
      />
    )
  }

  return (
    <main className='flex min-h-svh items-center justify-center bg-background p-6 md:p-10'>
      <section className='w-full max-w-sm'>
        <form
          aria-labelledby={`${formId}-title`}
          className='flex flex-col gap-6'
          noValidate
          onSubmit={submit}
        >
          <FieldGroup className='gap-5'>
            <div className='flex flex-col items-center gap-3 text-center'>
              <BrandMark />
              <div>
                <h1 className='font-bold text-xl' id={`${formId}-title`}>
                  Criar sua conta no Vaulty
                </h1>
                <p className='mt-2 text-muted-foreground text-sm'>
                  Você foi convidado para acessar o workspace.
                </p>
              </div>
            </div>

            <Field>
              <FieldLabel htmlFor={`${formId}-email`}>
                E-mail do convite
              </FieldLabel>
              <Input
                autoComplete='email'
                id={`${formId}-email`}
                readOnly
                value={email}
              />
            </Field>

            <p className='text-muted-foreground text-xs'>
              Prazo restante: {formatRemainingTime(remainingSeconds)}
            </p>

            <form.Field name='name'>
              {(field) => {
                const errorId = `${formId}-name-error`
                const invalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field invalid={invalid}>
                    <FieldLabel htmlFor={`${formId}-name`}>Nome</FieldLabel>
                    <Input
                      aria-describedby={invalid ? errorId : undefined}
                      aria-invalid={invalid}
                      autoComplete='name'
                      disabled={submitting}
                      id={`${formId}-name`}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      value={field.state.value}
                    />
                    <FieldError errors={field.state.meta.errors} id={errorId} />
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name='password'>
              {(field) => (
                <RegistrationPasswordField
                  disabled={submitting}
                  field={field}
                  formId={formId}
                  label='Senha'
                />
              )}
            </form.Field>

            <form.Field name='confirmPassword'>
              {(field) => (
                <RegistrationPasswordField
                  disabled={submitting}
                  field={field}
                  formId={formId}
                  label='Confirmar senha'
                />
              )}
            </form.Field>
          </FieldGroup>

          {requestError ? (
            <p className='text-destructive text-sm' role='alert'>
              {requestError}
            </p>
          ) : null}
          <Button
            disabled={!canSubmit || submitting}
            loading={submitting}
            type='submit'
          >
            {submitting ? 'Criando conta…' : 'CRIAR CONTA'}
          </Button>
        </form>
      </section>
    </main>
  )
}

interface PasswordFieldProps {
  disabled: boolean
  field: {
    handleBlur: () => void
    handleChange: (value: string) => void
    name: string
    state: {
      meta: {
        errors: Array<{ message?: string } | undefined>
        isTouched: boolean
        isValid: boolean
      }
      value: string
    }
  }
  formId: string
  label: string
}

function RegistrationPasswordField({
  disabled,
  field,
  formId,
  label,
}: PasswordFieldProps) {
  const inputId = `${formId}-${field.name}`
  const errorId = `${inputId}-error`
  const invalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <Field invalid={invalid}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <SecretInput
        aria-describedby={invalid ? errorId : undefined}
        aria-invalid={invalid}
        autoComplete='new-password'
        className='font-mono text-xs'
        disabled={disabled}
        id={inputId}
        name={field.name}
        onBlur={field.handleBlur}
        onValueChange={field.handleChange}
        value={field.state.value}
      />
      <FieldError errors={field.state.meta.errors} id={errorId} />
    </Field>
  )
}

function formatRemainingTime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (days > 0) {
    return `${days} d ${hours} h`
  }
  if (hours > 0) {
    return `${hours} h ${minutes} min`
  }
  return totalSeconds < 60 ? `${totalSeconds} s` : `${minutes} min`
}

function getRegistrationError(error: ApiError) {
  if (error.isRateLimited) {
    return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  }
  if (error.status === 400) {
    return 'Confira os dados informados e tente novamente.'
  }
  return 'Não foi possível criar sua conta. Verifique sua conexão e tente novamente.'
}
