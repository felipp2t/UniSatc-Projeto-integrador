// @vitest-environment happy-dom

import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionService } from '@/auth/session'
import type { RouterContext } from '@/router-context'
import { routerDefaults } from '@/router-defaults'
import { renderWithProviders } from '@/test/render'

const apiMocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  getMe: vi.fn(),
  inviteList: vi.fn(),
  updateProfile: vi.fn(),
}))

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

import { routeTree } from '@/route-tree.gen'

function createSession(): SessionService {
  return {
    dispose: vi.fn(),
    handleSessionExpired: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    setNavigateToLogin: vi.fn(),
    status: 'authenticated',
    updateUser: vi.fn(),
    user: { email: 'user@example.com', id: 'user-1', name: 'Conta Atual' },
  }
}

async function renderAccountSettings() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  })
  const router = createRouter({
    context: {
      permissionChecker: { can: () => true },
      queryClient,
      session: createSession(),
    } satisfies RouterContext,
    history: createMemoryHistory({ initialEntries: ['/configuracoes'] }),
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
  return renderWithProviders(<RouterProvider router={router} />, {
    queryClient,
  })
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
})
