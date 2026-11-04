import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { z } from 'zod'
import { inviteApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import type { InviteValidationResponse } from '@/api/types'
import { AuthStatus, BrandMark } from '@/components/auth-status'
import { InviteRegistrationForm } from '@/components/invite-registration-form'
import { unavailableMessage } from '@/components/invite-status'
import { ErrorState } from '@/components/ui/error-state'
import { OfflineState } from '@/components/ui/offline-state'

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
  deadline: number
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
      return {
        data,
        deadline: performance.now() + data.remainingSeconds * 1000,
      }
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
      <AuthStatus message={unavailableMessage} title='Convite indisponível' />
    )
  }

  if (validationQuery.fetchStatus === 'paused' && !validationQuery.data) {
    return <OfflineState />
  }

  if (validationQuery.isPending) {
    return (
      <AuthStatus
        message='Estamos conferindo se o convite ainda pode ser usado.'
        title='Validando convite'
      />
    )
  }

  if (validationQuery.isError) {
    const error = toApiError(validationQuery.error)
    if (error.status === 404) {
      return (
        <AuthStatus message={unavailableMessage} title='Convite indisponível' />
      )
    }

    if (error.isRateLimited) {
      return (
        <AuthStatus
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
      <AuthStatus
        message='Estamos conferindo se o convite ainda pode ser usado.'
        title='Validando convite'
      />
    )
  }

  return (
    <InviteRegistrationForm
      deadline={validation.deadline}
      email={validation.data.email}
      onGoToLogin={handleGoToLogin}
      onRegistered={handleRegistered}
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
