import { FolderSimpleIcon } from '@phosphor-icons/react'
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SecretInput } from '@/components/ui/secret-input'

export const Route = createFileRoute('/session')({
  component: LoginPage,
  head: () => ({ meta: [{ title: 'Entrar · Rootly' }] }),
})

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const loginForm = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setError('')

      try {
        const response = await fetch(`${apiUrl}/auth/login`, {
          body: JSON.stringify(value),
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })

        if (!response.ok) {
          setError(
            response.status === 429
              ? 'Muitas tentativas. Aguarde um minuto e tente novamente.'
              : 'E-mail ou senha inválidos.'
          )
          return
        }

        await navigate({ to: '/' })
      } catch {
        setError('Não foi possível conectar à API. Tente novamente.')
      }
    },
    validationLogic: revalidateLogic({
      mode: 'submit',
      modeAfterSubmission: 'change',
    }),
    validators: { onSubmit: loginSchema },
  })

  return (
    <main className='flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10'>
      <div className='w-full max-w-sm'>
        <form
          className='flex flex-col gap-6'
          onSubmit={(event) => {
            event.preventDefault()
            loginForm.handleSubmit()
          }}
        >
          <div className='flex flex-col items-center gap-2 text-center'>
            <div className='flex size-8 items-center justify-center rounded-md text-foreground'>
              <FolderSimpleIcon aria-hidden='true' size={24} weight='bold' />
            </div>
            <h1 className='font-bold text-xl'>Bem-vindo ao Rootly</h1>
            <FieldDescription>
              Entre para acessar seus workspaces.
            </FieldDescription>
          </div>
          <div className='flex flex-col gap-4'>
            <loginForm.Field
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>E-mail</FieldLabel>
                    <Input
                      autoComplete='email'
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder='seu.email@exemplo.com'
                      value={field.state.value}
                    />
                    <FieldError>
                      {field.state.meta.errors[0]?.message}
                    </FieldError>
                  </Field>
                )
              }}
              name='email'
            />
            <loginForm.Field
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field invalid={isInvalid || Boolean(error)}>
                    <FieldLabel htmlFor={field.name}>Senha</FieldLabel>
                    <SecretInput
                      autoComplete='current-password'
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder='Sua senha'
                      value={field.state.value}
                    />
                    <FieldError>
                      {field.state.meta.errors[0]?.message ?? error}
                    </FieldError>
                  </Field>
                )
              }}
              name='password'
            />
          </div>
          <loginForm.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                disabled={!canSubmit}
                loading={isSubmitting}
                type='submit'
              >
                Entrar
              </Button>
            )}
          </loginForm.Subscribe>
        </form>
      </div>
    </main>
  )
}
