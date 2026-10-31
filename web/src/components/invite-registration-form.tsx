import { revalidateLogic, useForm, useSelector } from '@tanstack/react-form'
import { useCallback, useEffect, useId, useState } from 'react'
import { z } from 'zod'
import { authApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import {
  getApiErrorMessage,
  RATE_LIMITED_MESSAGE,
  SERVER_UNAVAILABLE_MESSAGE,
} from '@/api/get-api-error-message'
import { AuthStatus, BrandMark } from '@/components/auth-status'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SecretInput } from '@/components/ui/secret-input'
import { unavailableMessage } from './invite-status'

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
  deadline: number
  email: string
  onGoToLogin: () => void
  onRegistered: () => Promise<void>
  token: string
}

export function InviteRegistrationForm({
  deadline,
  email,
  onGoToLogin,
  onRegistered,
  token,
}: InviteRegistrationFormProps) {
  const formId = useId()
  const [requestError, setRequestError] = useState<string>()
  const [completionError, setCompletionError] = useState<string>()
  const [inviteUnavailable, setInviteUnavailable] = useState(false)
  const [now, setNow] = useState(() => performance.now())
  const remainingSeconds = Math.max(0, Math.ceil((deadline - now) / 1000))
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

        setRequestError(
          getApiErrorMessage(error, {
            fallback: 'Não foi possível criar sua conta. Tente novamente.',
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
    const update = () => {
      const currentTime = performance.now()
      setNow(currentTime)
      if (currentTime >= deadline) {
        window.clearInterval(timer)
      }
    }
    const timer = window.setInterval(update, 1000)
    window.addEventListener('pageshow', update)
    document.addEventListener('visibilitychange', update)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pageshow', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [deadline])

  if (remainingSeconds === 0) {
    return (
      <AuthStatus message={unavailableMessage} title='Convite indisponível' />
    )
  }

  if (inviteUnavailable) {
    return (
      <AuthStatus message={unavailableMessage} title='Convite indisponível' />
    )
  }

  if (completionError) {
    return (
      <AuthStatus
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
              {(field) => {
                const invalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <RegistrationPasswordField
                    disabled={submitting}
                    errors={field.state.meta.errors}
                    formId={formId}
                    invalid={invalid}
                    label='Senha'
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    value={field.state.value}
                    visibilityLabel='senha'
                  />
                )
              }}
            </form.Field>

            <form.Field name='confirmPassword'>
              {(field) => {
                const invalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <RegistrationPasswordField
                    disabled={submitting}
                    errors={field.state.meta.errors}
                    formId={formId}
                    invalid={invalid}
                    label='Confirmar senha'
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    value={field.state.value}
                    visibilityLabel='confirmação da senha'
                  />
                )
              }}
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

type RegistrationValues = z.infer<typeof registrationSchema>
type PasswordFieldName = 'password' | 'confirmPassword'
interface PasswordFieldProps {
  disabled: boolean
  errors: Array<{ message?: string } | undefined>
  formId: string
  invalid: boolean
  label: string
  name: PasswordFieldName
  onBlur: () => void
  onChange: (value: string) => void
  value: RegistrationValues[PasswordFieldName]
  visibilityLabel: string
}

function RegistrationPasswordField({
  disabled,
  errors,
  formId,
  invalid,
  label,
  name,
  onBlur,
  onChange,
  visibilityLabel,
  value,
}: PasswordFieldProps) {
  const inputId = `${formId}-${name}`
  const errorId = `${inputId}-error`

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
        name={name}
        onBlur={onBlur}
        onValueChange={onChange}
        value={value}
        visibilityLabel={visibilityLabel}
      />
      <FieldError errors={errors} id={errorId} />
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
