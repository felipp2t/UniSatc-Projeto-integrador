import { FolderIcon } from '@phosphor-icons/react'
import { revalidateLogic, useForm, useSelector } from '@tanstack/react-form'
import {
  createFileRoute,
  useNavigate,
  useRouteContext,
} from '@tanstack/react-router'
import { cn } from 'cn'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { authApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { sanitizeInternalRedirect } from '@/auth/redirect'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const inputClassName =
  'dark:border-input/40 focus-visible:outline-none focus-visible:border-input/40 focus-visible:ring-2 focus-visible:ring-input/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background'

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
        const apiError = toApiError(cause)
        setError(
          apiError.isRateLimited
            ? 'Too many login attempts. Please wait a few minutes before trying again.'
            : 'Invalid email or password.'
        )
        return
      }

      try {
        await session.initialize(true)
        if (session.status !== 'authenticated') {
          setError(
            'Unable to confirm your session. Please try logging in again.'
          )
          return
        }

        await navigate({
          href: destination ?? '/',
          search: { redirect: undefined },
        })
      } catch {
        setError(
          'Login succeeded, but we could not continue. Please try again.'
        )
      }
    },
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onSubmit: z.object({
        email: z.email('Please enter a valid email address.'),
        password: z
          .string()
          .min(6, 'Password must be at least 6 characters long.'),
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
                  Welcome to Vaulty
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
                          className='font-sans text-sm leading-none'
                          htmlFor={field.name}
                        >
                          Email
                        </FieldLabel>
                        <Input
                          aria-describedby={invalid ? errorId : undefined}
                          aria-invalid={invalid}
                          autoComplete='off'
                          className={cn(
                            inputClassName,
                            'rounded-md bg-background py-1 font-sans text-base md:text-sm'
                          )}
                          disabled={submitting}
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onValueChange={field.handleChange}
                          placeholder='your.email@example.com'
                          value={field.state.value}
                        />
                        <FieldError
                          className='font-normal text-sm'
                          id={errorId}
                        >
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
                          className='font-sans text-sm leading-none'
                          htmlFor={field.name}
                        >
                          Password
                        </FieldLabel>
                        <Input
                          aria-describedby={invalid ? errorId : undefined}
                          aria-invalid={invalid}
                          autoComplete='off'
                          className={cn(
                            inputClassName,
                            'rounded-md bg-background py-1 font-sans text-base md:text-sm'
                          )}
                          disabled={submitting}
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onValueChange={field.handleChange}
                          placeholder='123456'
                          type='password'
                          value={field.state.value}
                        />
                        <FieldError
                          className='font-normal text-sm'
                          id={errorId}
                        >
                          {field.state.meta.errors[0]?.message ? (
                            <p>{field.state.meta.errors[0].message}</p>
                          ) : null}
                        </FieldError>
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
                  className='cursor-pointer rounded-md font-bold tracking-[0.05em] hover:bg-primary hover:brightness-110'
                  disabled={!canSubmit || submitting}
                  loading={submitting}
                  type='submit'
                >
                  {submitting ? 'Logging in...' : 'Login'}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </div>
      </div>
    </div>
  )
}
