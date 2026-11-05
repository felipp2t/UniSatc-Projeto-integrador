// @vitest-environment happy-dom

import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import type { SessionService } from '@/auth/session'
import type { RouterContext } from '@/config/routes/router-context'
import { routerDefaults } from '@/config/routes/router-defaults'
import { renderWithProviders } from '@/test/render'
import { createSessionStub } from '@/test/session-stub'

const apiMocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  getMe: vi.fn(),
  inviteList: vi.fn(),
  updateProfile: vi.fn(),
}))
const toastMocks = vi.hoisted(() => ({ success: vi.fn() }))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    inviteApi: { ...actual.inviteApi, list: apiMocks.inviteList },
    userApi: {
      ...actual.userApi,
      changePassword: apiMocks.changePassword,
      getMe: apiMocks.getMe,
      updateProfile: apiMocks.updateProfile,
    },
  }
})

vi.mock('@/components/ui/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/toast')>()
  return {
    ...actual,
    appToast: { ...actual.appToast, success: toastMocks.success },
  }
})

import { routeTree } from '@/route-tree.gen'

function createSession(): SessionService {
  return createSessionStub({
    status: 'authenticated',
    user: { email: 'user@example.com', id: 'user-1', name: 'Conta Atual' },
  })
}

async function renderAccountSettings() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  })
  const session = createSession()
  const router = createRouter({
    context: {
      queryClient,
      session,
    } satisfies RouterContext,
    history: createMemoryHistory({ initialEntries: ['/configuracoes/conta'] }),
    isServer: false,
    routeTree,
    ...routerDefaults,
  })
  router.startTransition = (transition) => {
    transition()
    return Promise.resolve(true)
  }
  router.updateLatestLocation()
  await router.load({ sync: true })
  const rendered = renderWithProviders(<RouterProvider router={router} />, {
    queryClient,
  })
  return { ...rendered, router, session }
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMocks.getMe.mockResolvedValue({
    data: {
      createdAt: '2026-01-15T12:00:00Z',
      email: 'user@example.com',
      name: 'Conta Atual',
    },
  })
})

afterEach(() => vi.restoreAllMocks())

describe('account settings', () => {
  it('keeps profile and password settings without loading workspace invites', async () => {
    await renderAccountSettings()

    expect(await screen.findByRole('textbox', { name: 'Nome' })).toHaveValue(
      'Conta Atual'
    )
    expect(screen.getByRole('textbox', { name: 'E-mail' })).toHaveValue(
      'user@example.com'
    )
    expect(
      screen.getByRole('heading', { name: 'Alterar senha' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Senha atual')).toBeInTheDocument()
    expect(apiMocks.getMe).toHaveBeenCalledOnce()
    expect(apiMocks.inviteList).not.toHaveBeenCalled()
  })

  it('shows the shared network message, keeps the edited name, and allows retry', async () => {
    const user = userEvent.setup()
    apiMocks.updateProfile
      .mockRejectedValueOnce(
        new ApiError('network failure', undefined, undefined, undefined, {
          networkError: true,
        })
      )
      .mockResolvedValueOnce(undefined)
    await renderAccountSettings()

    const nameInput = await screen.findByRole('textbox', { name: 'Nome' })
    await user.clear(nameInput)
    await user.type(nameInput, 'Nome atualizado')
    await user.click(screen.getByRole('button', { name: 'Salvar nome' }))

    expect(
      await screen.findByText(
        'Erro de conexão. Verifique sua internet e tente novamente.'
      )
    ).toBeInTheDocument()
    expect(nameInput).toHaveValue('Nome atualizado')

    await user.click(screen.getByRole('button', { name: 'Salvar nome' }))
    expect(apiMocks.updateProfile).toHaveBeenNthCalledWith(2, {
      name: 'Nome atualizado',
    })
  })

  it('uses the account fallback without exposing an unclassified error', async () => {
    apiMocks.updateProfile.mockRejectedValueOnce(new Error('Internal detail'))
    const user = userEvent.setup()
    await renderAccountSettings()

    const nameInput = await screen.findByRole('textbox', { name: 'Nome' })
    await user.clear(nameInput)
    await user.type(nameInput, 'Nome atualizado')
    await user.click(screen.getByRole('button', { name: 'Salvar nome' }))

    expect(
      await screen.findByText(
        'Não foi possível salvar o nome. Tente novamente.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Internal detail')).not.toBeInTheDocument()
    expect(nameInput).toHaveValue('Nome atualizado')
  })

  it('clears the local session and replaces the settings route with login after changing the password', async () => {
    apiMocks.changePassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    const { router, session } = await renderAccountSettings()

    await user.type(screen.getByLabelText('Senha atual'), 'current-password')
    await user.type(screen.getByLabelText('Nova senha'), 'new-password')
    await user.type(
      screen.getByLabelText('Confirmar nova senha'),
      'new-password'
    )
    await user.click(screen.getByRole('button', { name: 'ALTERAR SENHA' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(apiMocks.changePassword).toHaveBeenCalledWith({
      confirmPassword: 'new-password',
      currentPassword: 'current-password',
      newPassword: 'new-password',
    })
    expect(session.clearLocalSession).toHaveBeenCalledOnce()
    expect(apiMocks.changePassword.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(session.clearLocalSession).mock.invocationCallOrder[0]
    )
    expect(toastMocks.success).toHaveBeenCalledWith(
      'Senha alterada. Entre novamente com sua nova senha.'
    )
    expect(router.state.location.search).toEqual({ redirect: undefined })
    expect(router.state.location.pathname).toBe('/login')
    router.history.back()
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it.each([
    [new ApiError('Senha atual incorreta', 400), 'Senha atual incorreta'],
    [
      new ApiError('network failure', undefined, undefined, undefined, {
        networkError: true,
      }),
      'Não foi possível alterar sua senha. Verifique sua conexão e tente novamente.',
    ],
  ])(
    'keeps the session, password fields, and settings route after a failed password change (%s)',
    async (error, message) => {
      apiMocks.changePassword.mockRejectedValueOnce(error)
      const user = userEvent.setup()
      const { router, session } = await renderAccountSettings()
      const passwordValues = [
        ['Senha atual', 'current-password'],
        ['Nova senha', 'new-password'],
        ['Confirmar nova senha', 'new-password'],
      ] as const

      await user.type(screen.getByLabelText('Senha atual'), 'current-password')
      await user.type(screen.getByLabelText('Nova senha'), 'new-password')
      await user.type(
        screen.getByLabelText('Confirmar nova senha'),
        'new-password'
      )
      await user.click(screen.getByRole('button', { name: 'ALTERAR SENHA' }))

      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/configuracoes/conta')
      expect(session.clearLocalSession).not.toHaveBeenCalled()
      expect(toastMocks.success).not.toHaveBeenCalled()
      for (const [label, value] of passwordValues) {
        expect(screen.getByLabelText(label)).toHaveValue(value)
      }
    }
  )

  it('does not send a password change when confirmation differs and keeps both values', async () => {
    const user = userEvent.setup()
    const { router, session } = await renderAccountSettings()
    await user.type(screen.getByLabelText('Senha atual'), 'current-password')
    await user.type(screen.getByLabelText('Nova senha'), 'new-password')
    await user.type(
      screen.getByLabelText('Confirmar nova senha'),
      'other-password'
    )
    await user.click(screen.getByRole('button', { name: 'ALTERAR SENHA' }))

    expect(
      await screen.findByText('As senhas não coincidem.')
    ).toBeInTheDocument()
    expect(apiMocks.changePassword).not.toHaveBeenCalled()
    expect(session.clearLocalSession).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/configuracoes/conta')
    expect(screen.getByLabelText('Nova senha')).toHaveValue('new-password')
    expect(screen.getByLabelText('Confirmar nova senha')).toHaveValue(
      'other-password'
    )
  })
})
