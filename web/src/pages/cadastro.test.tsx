// @vitest-environment happy-dom

import { onlineManager } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { createQueryClient } from '@/api/query-client'
import type { SessionService, SessionStatus } from '@/auth/session'
import { renderWithProviders } from '@/test/render'
import { routeTree } from '../route-tree.gen'

const { register, validate } = vi.hoisted(() => ({
  register: vi.fn(),
  validate: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    authApi: { ...actual.authApi, register },
    inviteApi: { ...actual.inviteApi, validate },
  }
})

function createSession() {
  let status: SessionStatus = 'unauthenticated'
  let user: SessionService['user']
  return {
    dispose: vi.fn(),
    handleSessionExpired: vi.fn(),
    initialize: vi.fn(() => {
      status = 'authenticated'
      user = {
        email: 'convidado@example.com',
        id: 'user-id',
        name: 'Convidado',
      }
      return Promise.resolve()
    }),
    logout: vi.fn(),
    setNavigateToLogin: vi.fn(),
    get status() {
      return status
    },
    updateUser: vi.fn(),
    get user() {
      return user
    },
  } as SessionService
}

async function renderRegistrationPage(
  entry: string,
  queryClient = createQueryClient()
) {
  const session = createSession()
  const router = createRouter({
    context: {
      permissionChecker: { can: () => true },
      queryClient,
      session,
    },
    history: createMemoryHistory({ initialEntries: [entry] }),
    isServer: false,
    routeTree,
  })
  router.startTransition = (transition) => {
    transition()
    return Promise.resolve(true)
  }
  router.updateLatestLocation()
  await router.load({ sync: true })
  const rendered = renderWithProviders(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
    { queryClient }
  )
  return { ...rendered, queryClient, router, session }
}

async function fillValidRegistration(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nome'), 'Ana Exemplo')
  await user.type(screen.getByLabelText('Senha'), ' senha segura ')
  await user.type(screen.getByLabelText('Confirmar senha'), ' senha segura ')
}

afterEach(() => {
  cleanup()
  onlineManager.setOnline(true)
  vi.restoreAllMocks()
  vi.resetAllMocks()
})

describe('cadastro por convite', () => {
  it('shows unavailable for a missing invite without redirecting to login', async () => {
    const { router } = await renderRegistrationPage('/cadastro')

    expect(await screen.findByText('Convite indisponível')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/cadastro')
    expect(validate).not.toHaveBeenCalled()
  })

  it('shows the unavailable state for an invalid invite', async () => {
    validate.mockRejectedValue(new ApiError('Convite indisponível', 404))

    await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=invalido'
    )

    expect(await screen.findByText('Convite indisponível')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'CRIAR CONTA' })).toBeNull()
  })

  it('allows retry after a temporary validation failure', async () => {
    validate
      .mockRejectedValueOnce(
        new ApiError('Falha temporária', undefined, undefined, undefined, {
          networkError: true,
        })
      )
      .mockRejectedValueOnce(
        new ApiError('Falha temporária', undefined, undefined, undefined, {
          networkError: true,
        })
      )
      .mockRejectedValueOnce(
        new ApiError('Falha temporária', undefined, undefined, undefined, {
          networkError: true,
        })
      )
      .mockResolvedValueOnce({
        data: { email: 'convidado@example.com', remainingSeconds: 4000 },
      })

    const user = userEvent.setup()
    await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=valido'
    )

    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Tentar novamente' },
        { timeout: 5000 }
      )
    )

    expect(
      await screen.findByRole('button', { name: 'CRIAR CONTA' })
    ).toBeTruthy()
    expect(screen.getByText('Prazo restante: 1 h 6 min')).toBeTruthy()
    expect(validate).toHaveBeenCalledTimes(4)
  })

  it('deduplicates invite validation in StrictMode and preserves elapsed time on remount', async () => {
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    validate.mockResolvedValue({
      data: { email: 'convidado@example.com', remainingSeconds: 4000 },
    })

    const queryClient = createQueryClient()
    const firstRender = await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=valido',
      queryClient
    )

    await screen.findByRole('button', { name: 'CRIAR CONTA' })
    expect(validate).toHaveBeenCalledOnce()
    firstRender.unmount()

    now += 65_000
    await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=valido',
      queryClient
    )

    await screen.findByRole('button', { name: 'CRIAR CONTA' })
    expect(validate).toHaveBeenCalledOnce()
    expect(screen.getByText('Prazo restante: 1 h 5 min')).toBeTruthy()
  })

  it('keeps the validated form visible when an offline refetch pauses', async () => {
    validate.mockResolvedValue({
      data: { email: 'convidado@example.com', remainingSeconds: 4000 },
    })

    const { queryClient } = await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=valido'
    )
    const registrationButton = await screen.findByRole('button', {
      name: 'CRIAR CONTA',
    })
    const queryKey = [
      'invite-validation',
      'convidado@example.com',
      'valido',
    ] as const

    onlineManager.setOnline(false)
    queryClient.invalidateQueries({ queryKey }).catch(() => undefined)

    await waitFor(() =>
      expect(queryClient.getQueryState(queryKey)?.fetchStatus).toBe('paused')
    )
    expect(registrationButton).toBeTruthy()
    expect(screen.queryByText('Você está offline')).toBeNull()
  })

  it('asks the visitor to wait when validation is rate limited', async () => {
    validate.mockRejectedValue(new ApiError('Muitas tentativas', 429))

    await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=valido'
    )

    expect(
      await screen.findByText(
        'Muitas tentativas. Aguarde um minuto e tente abrir novamente o link do convite.'
      )
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' })
    ).toBeNull()
  })

  it('registers with the validated identity, preserves the password, and starts a session', async () => {
    validate.mockResolvedValue({
      data: { email: 'convidado@example.com', remainingSeconds: 4000 },
    })
    register.mockResolvedValue({ data: undefined })

    const user = userEvent.setup()
    const { router, session } = await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=valido'
    )

    await screen.findByRole('button', { name: 'CRIAR CONTA' })
    await fillValidRegistration(user)
    await user.click(screen.getByRole('button', { name: 'CRIAR CONTA' }))

    await waitFor(() => expect(register).toHaveBeenCalledOnce())
    expect(register).toHaveBeenCalledWith({
      confirmPassword: ' senha segura ',
      email: 'convidado@example.com',
      name: 'Ana Exemplo',
      password: ' senha segura ',
      token: 'valido',
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(router.state.location.search).toEqual({})
    expect(session.initialize).toHaveBeenCalledWith(true)
  })

  it.each([404, 409])(
    'uses the same unavailable message when registration returns %i',
    async (status) => {
      validate.mockResolvedValue({
        data: { email: 'convidado@example.com', remainingSeconds: 4000 },
      })
      register.mockRejectedValue(new ApiError('Convite expirado', status))

      const user = userEvent.setup()
      await renderRegistrationPage(
        '/cadastro?email=convidado%40example.com&token=valido'
      )

      await screen.findByRole('button', { name: 'CRIAR CONTA' })
      await fillValidRegistration(user)
      await user.click(screen.getByRole('button', { name: 'CRIAR CONTA' }))

      expect(
        await screen.findByRole('heading', { name: 'Convite indisponível' })
      ).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'CRIAR CONTA' })).toBeNull()
    }
  )

  it('shows local validation errors without sending the registration request', async () => {
    validate.mockResolvedValue({
      data: { email: 'convidado@example.com', remainingSeconds: 4000 },
    })

    const user = userEvent.setup()
    await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=valido'
    )

    await screen.findByRole('button', { name: 'CRIAR CONTA' })
    await user.type(screen.getByLabelText('Nome'), 'Al')
    await user.type(screen.getByLabelText('Senha'), 'curta')
    await user.type(screen.getByLabelText('Confirmar senha'), 'diferente')
    fireEvent.submit(
      screen.getByRole('form', { name: 'Criar sua conta no Vaulty' })
    )

    expect(
      await screen.findByText('O nome deve ter pelo menos 3 caracteres.')
    ).toBeTruthy()
    expect(
      screen.getByText('A senha deve ter pelo menos 8 caracteres.')
    ).toBeTruthy()
    expect(screen.getByText('As senhas não coincidem.')).toBeTruthy()
    expect(register).not.toHaveBeenCalled()
  })

  it.each([
    [400, 'Confira os dados informados e tente novamente.'],
    [429, 'Muitas tentativas. Aguarde um pouco e tente novamente.'],
  ])(
    'shows a recoverable registration message for HTTP %i',
    async (status, message) => {
      validate.mockResolvedValue({
        data: { email: 'convidado@example.com', remainingSeconds: 4000 },
      })
      register.mockRejectedValue(new ApiError('Falha', status))

      const user = userEvent.setup()
      await renderRegistrationPage(
        '/cadastro?email=convidado%40example.com&token=valido'
      )
      await screen.findByRole('button', { name: 'CRIAR CONTA' })
      await fillValidRegistration(user)
      await user.click(screen.getByRole('button', { name: 'CRIAR CONTA' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
    }
  )

  it('shows a recoverable message when registration fails due to a network error', async () => {
    validate.mockResolvedValue({
      data: { email: 'convidado@example.com', remainingSeconds: 4000 },
    })
    register.mockRejectedValue(
      new ApiError('Falha temporária', undefined, undefined, undefined, {
        networkError: true,
      })
    )

    const user = userEvent.setup()
    await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=valido'
    )
    await screen.findByRole('button', { name: 'CRIAR CONTA' })
    await fillValidRegistration(user)
    await user.click(screen.getByRole('button', { name: 'CRIAR CONTA' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível criar sua conta. Verifique sua conexão e tente novamente.'
    )
  })

  it('shows a recoverable message when registration fails with a server error', async () => {
    validate.mockResolvedValue({
      data: { email: 'convidado@example.com', remainingSeconds: 4000 },
    })
    register.mockRejectedValue(new ApiError('Falha do servidor', 500))

    const user = userEvent.setup()
    await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=valido'
    )
    await screen.findByRole('button', { name: 'CRIAR CONTA' })
    await fillValidRegistration(user)
    await user.click(screen.getByRole('button', { name: 'CRIAR CONTA' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível criar sua conta. Verifique sua conexão e tente novamente.'
    )
  })

  it('shows completed registration when session initialization fails', async () => {
    validate.mockResolvedValue({
      data: { email: 'convidado@example.com', remainingSeconds: 4000 },
    })
    register.mockResolvedValue({ data: undefined })

    const user = userEvent.setup()
    const { session } = await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=valido'
    )
    vi.spyOn(session, 'initialize').mockRejectedValueOnce(
      new Error('Falha de sessão')
    )

    await screen.findByRole('button', { name: 'CRIAR CONTA' })
    await fillValidRegistration(user)
    await user.click(screen.getByRole('button', { name: 'CRIAR CONTA' }))

    expect(
      await screen.findByRole('heading', { name: 'Cadastro concluído' })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ir para o login' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'CRIAR CONTA' })).toBeNull()
  })

  it('shows the unavailable state when the countdown reaches zero', async () => {
    validate.mockResolvedValue({
      data: { email: 'convidado@example.com', remainingSeconds: 1 },
    })

    await renderRegistrationPage(
      '/cadastro?email=convidado%40example.com&token=valido'
    )
    await screen.findByRole('button', { name: 'CRIAR CONTA' })

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Convite indisponível' },
        { timeout: 3000 }
      )
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'CRIAR CONTA' })).toBeNull()
  })
})
