import { KeyIcon } from '@phosphor-icons/react'
import { revalidateLogic, useForm, useSelector } from '@tanstack/react-form'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { z } from 'zod'
import { userApi } from '@/api/endpoints'
import { type ApiError, toApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const passwordSchema = z
  .object({
    confirmPassword: z.string().min(1, 'Confirme sua nova senha.'),
    currentPassword: z.string().min(1, 'Informe sua senha atual.'),
    newPassword: z
      .string()
      .min(8, 'A nova senha deve ter pelo menos 8 caracteres.'),
  })
  .refine(
    ({ confirmPassword, newPassword }) => confirmPassword === newPassword,
    {
      message: 'As senhas não coincidem.',
      path: ['confirmPassword'],
    }
  )

const LOWERCASE_PATTERN = /[a-z]/
const UPPERCASE_PATTERN = /[A-Z]/
const NUMBER_PATTERN = /\d/
const SYMBOL_PATTERN = /[^a-zA-Z0-9]/
const passwordInputClassName =
  'border border-border rounded-none focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-0'

export function ChangePasswordForm() {
  const formId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [requestError, setRequestError] = useState<string>()
  const [success, setSuccess] = useState(false)
  const isCurrentPasswordError = requestError === 'Senha atual incorreta'
  const form = useForm({
    defaultValues: {
      confirmPassword: '',
      currentPassword: '',
      newPassword: '',
    },
    onSubmit: async ({ value }) => {
      setRequestError(undefined)
      setSuccess(false)
      try {
        await userApi.changePassword(value)
        form.reset()
        setSuccess(true)
      } catch (error) {
        setRequestError(getPasswordChangeError(toApiError(error)))
      }
    },
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: { onDynamic: passwordSchema },
  })
  const submitting = useSelector(form.store, (state) => state.isSubmitting)
  const canSubmit = useSelector(form.store, (state) => state.canSubmit)
  const newPassword = useSelector(
    form.store,
    (state) => state.values.newPassword
  )

  const strength = getPasswordStrength(newPassword)
  const submit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      form.handleSubmit().catch(() => undefined)
    },
    [form]
  )

  useEffect(() => {
    if (isCurrentPasswordError && !submitting) {
      formRef.current
        ?.querySelector<HTMLInputElement>('[name="currentPassword"]')
        ?.focus()
    }
  }, [isCurrentPasswordError, submitting])

  return (
    <section
      aria-labelledby={`${formId}-title`}
      className='flex flex-col gap-4'
    >
      <h2
        className='font-bold font-mono text-sm uppercase tracking-wide'
        id={`${formId}-title`}
      >
        Alterar senha
      </h2>
      <form noValidate onSubmit={submit} ref={formRef}>
        <FieldGroup className='gap-4'>
          <form.Field name='currentPassword'>
            {(field) => (
              <PasswordField
                autoComplete='current-password'
                disabled={submitting}
                field={field}
                formId={formId}
                label='Senha atual'
                serverError={isCurrentPasswordError ? requestError : undefined}
              />
            )}
          </form.Field>
          <form.Field name='newPassword'>
            {(field) => (
              <PasswordField
                autoComplete='new-password'
                disabled={submitting}
                field={field}
                formId={formId}
                label='Nova senha'
              >
                <p
                  className='text-muted-foreground text-xs'
                  id={`${formId}-strength`}
                >
                  Força estimada (indicativa): {strength.label}
                </p>
                <div
                  aria-hidden='true'
                  className='h-1 w-full overflow-hidden rounded-full bg-muted'
                >
                  <div
                    className={`h-full transition-all ${strength.color}`}
                    style={{ width: `${(strength.score / 4) * 100}%` }}
                  />
                </div>
              </PasswordField>
            )}
          </form.Field>
          <form.Field name='confirmPassword'>
            {(field) => (
              <PasswordField
                autoComplete='new-password'
                disabled={submitting}
                field={field}
                formId={formId}
                label='Confirmar nova senha'
              />
            )}
          </form.Field>
        </FieldGroup>

        {requestError && !isCurrentPasswordError ? (
          <p className='mt-4 text-destructive text-sm' role='alert'>
            {requestError}
          </p>
        ) : null}
        {success ? (
          <p
            aria-live='polite'
            className='mt-4 text-muted-foreground text-xs'
            role='status'
          >
            Senha alterada. Você e os outros dispositivos precisarão entrar
            novamente quando as sessões expirarem.
          </p>
        ) : null}

        <div className='mt-4 flex'>
          <Button
            className='self-start'
            disabled={!canSubmit || submitting}
            loading={submitting}
            type='submit'
          >
            {submitting ? null : <KeyIcon aria-hidden='true' size={16} />}
            ALTERAR SENHA
          </Button>
        </div>
      </form>
    </section>
  )
}

interface PasswordFieldProps {
  autoComplete: 'current-password' | 'new-password'
  children?: React.ReactNode
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
  serverError?: string
}

function PasswordField({
  autoComplete,
  children,
  disabled,
  field,
  formId,
  label,
  serverError,
}: PasswordFieldProps) {
  const inputId = `${formId}-${field.name}`
  const errorId = `${inputId}-error`
  const invalid = field.state.meta.isTouched && !field.state.meta.isValid
  const describedBy =
    [
      invalid || serverError ? errorId : undefined,
      children ? `${formId}-strength` : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <Field invalid={invalid || Boolean(serverError)}>
      <FieldLabel
        className='font-mono font-semibold text-muted-foreground text-xs uppercase tracking-wide'
        htmlFor={inputId}
      >
        {label}
      </FieldLabel>
      <Input
        aria-describedby={describedBy}
        aria-invalid={invalid || Boolean(serverError)}
        autoComplete={autoComplete}
        className={passwordInputClassName}
        disabled={disabled}
        id={inputId}
        name={field.name}
        onBlur={field.handleBlur}
        onValueChange={field.handleChange}
        type='password'
        value={field.state.value}
      />
      <FieldError errors={field.state.meta.errors} id={errorId}>
        {serverError}
      </FieldError>
      {children}
    </Field>
  )
}

function getPasswordStrength(password: string) {
  const checks = [
    password.length >= 8,
    LOWERCASE_PATTERN.test(password) && UPPERCASE_PATTERN.test(password),
    NUMBER_PATTERN.test(password),
    SYMBOL_PATTERN.test(password),
  ]
  const score = checks.filter(Boolean).length
  const labels = ['Não informada', 'Fraca', 'Razoável', 'Boa', 'Forte']
  const colors = [
    'bg-muted',
    'bg-destructive',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-emerald-600',
  ]

  return { color: colors[score], label: labels[score], score }
}

function getPasswordChangeError(error: ApiError) {
  if (error.status === 400 && error.message === 'Senha atual incorreta') {
    return error.message
  }

  if (error.status === 429) {
    return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  }

  if (error.status && error.status < 500 && error.message !== 'Network Error') {
    return error.message
  }

  return 'Não foi possível alterar sua senha. Verifique sua conexão e tente novamente.'
}
