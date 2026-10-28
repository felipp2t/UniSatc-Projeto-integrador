import { UserGearIcon, UserIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { userApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { ChangePasswordForm } from '@/components/change-password-form'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { Separator } from '@/components/ui/separator'
import { appToast } from '@/components/ui/toast'

const profileNameSchema = z
  .string()
  .trim()
  .min(3, 'O nome deve ter pelo menos 3 caracteres.')
  .max(100, 'O nome deve ter no máximo 100 caracteres.')

export const Route = createFileRoute('/_protected/configuracoes')({
  component: AccountSettingsPage,
  head: () => ({ meta: [{ title: 'Configurações da conta | Vaulty' }] }),
})

function AccountSettingsPage() {
  const { session } = Route.useRouteContext()
  const nameId = useId()
  const [name, setName] = useState<string>()
  const [nameError, setNameError] = useState<string>()
  const profile = useQuery({
    queryFn: async () => (await userApi.getMe()).data,
    queryKey: ['profile'],
  })
  const currentName = profile.data?.name ?? ''
  const editedName = name ?? currentName
  const isNameValid = profileNameSchema.safeParse(editedName).success
  const isNameChanged = editedName !== currentName

  const retryProfile = useCallback(async () => {
    await profile.refetch()
  }, [profile.refetch])
  const changeName = useCallback((value: string) => {
    setName(value)
    setNameError(undefined)
  }, [])
  const saveName = useCallback(
    async (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      const result = profileNameSchema.safeParse(editedName)
      if (!result.success) {
        setNameError(result.error.issues[0]?.message)
        return
      }

      setNameError(undefined)
      try {
        await userApi.updateProfile({ name: result.data })
        session.updateUser({
          ...session.user,
          name: result.data,
        })
        setName(undefined)
        appToast.success('Nome atualizado com sucesso.')
      } catch (error) {
        setNameError(
          getApiErrorMessage(error, {
            fallback: 'Não foi possível salvar o nome. Tente novamente.',
          })
        )
      }
    },
    [editedName, session]
  )

  return (
    <main className='container mx-auto space-y-6 px-8 py-12'>
      <header className='flex flex-col gap-6'>
        <AppBreadcrumb
          items={[{ label: 'Início', to: '/' }, { label: 'Conta' }]}
        />
        <div className='flex items-center gap-4'>
          <UserGearIcon
            aria-hidden='true'
            className='size-6 shrink-0 text-primary'
          />
          <h1 className='font-bold font-mono text-3xl'>CONTA</h1>
        </div>
      </header>

      <div className='flex min-w-0 flex-col gap-8 sm:flex-row'>
        <nav
          aria-label='Configurações da conta'
          className='flex w-full shrink-0 flex-col gap-1 sm:w-52'
        >
          <Link
            activeProps={{
              className: 'border-primary bg-primary/10 text-primary',
            }}
            className='flex cursor-pointer items-center gap-2.5 border-l-2 px-3 py-2 text-left font-mono font-semibold text-xs uppercase tracking-wide transition-colors'
            inactiveProps={{
              className:
                'border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground',
            }}
            to='/configuracoes'
          >
            <UserIcon aria-hidden='true' className='size-3.5 shrink-0' />
            Perfil
          </Link>
        </nav>

        <Separator className='hidden h-auto sm:block' orientation='vertical' />
        <Separator className='sm:hidden' />

        <div className='min-w-0 flex-1'>
          <div className='max-w-md space-y-8'>
            <section aria-labelledby='profile-title' className='space-y-4'>
              <div>
                <h2
                  className='font-bold font-mono text-sm uppercase tracking-wide'
                  id='profile-title'
                >
                  Perfil
                </h2>
                <p className='mt-1 text-muted-foreground text-xs'>
                  Consulte seus dados e atualize seu nome.
                </p>
              </div>
              {profile.isPending ? (
                <LoadingState label='Carregando perfil…' />
              ) : null}
              {profile.isError ? (
                <ErrorState
                  error={profile.error}
                  message='Não foi possível carregar seu perfil. Verifique sua conexão.'
                  onRetry={retryProfile}
                />
              ) : null}
              {profile.data ? (
                <form className='space-y-4' noValidate onSubmit={saveName}>
                  <Field invalid={Boolean(nameError)}>
                    <FieldLabel htmlFor={nameId}>Nome</FieldLabel>
                    <Input
                      aria-describedby={
                        nameError ? `${nameId}-error` : undefined
                      }
                      aria-invalid={Boolean(nameError)}
                      autoComplete='name'
                      id={nameId}
                      maxLength={100}
                      onValueChange={changeName}
                      value={editedName}
                    />
                    <FieldError id={`${nameId}-error`}>{nameError}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${nameId}-email`}>E-mail</FieldLabel>
                    <Input
                      id={`${nameId}-email`}
                      readOnly
                      value={profile.data.email ?? ''}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${nameId}-created`}>
                      Conta criada em
                    </FieldLabel>
                    <Input
                      id={`${nameId}-created`}
                      readOnly
                      value={
                        profile.data.createdAt
                          ? new Intl.DateTimeFormat('pt-BR', {
                              dateStyle: 'long',
                            }).format(new Date(profile.data.createdAt))
                          : '—'
                      }
                    />
                  </Field>
                  <Button
                    disabled={!(isNameChanged && isNameValid)}
                    type='submit'
                  >
                    Salvar nome
                  </Button>
                </form>
              ) : null}
            </section>
            <Separator />
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </main>
  )
}
