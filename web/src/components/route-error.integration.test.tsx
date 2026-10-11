// @vitest-environment happy-dom

import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import type { SessionService } from '@/auth/session'
import type { RouterContext } from '@/router-context'
import { routerDefaults } from '@/router-defaults'
import '@/test/dom-setup'

afterEach(() => vi.restoreAllMocks())
afterEach(() => vi.unstubAllEnvs())

function createSession(initialize: () => Promise<void>): SessionService {
  return {
    dispose: vi.fn(),
    handleSessionExpired: vi.fn(),
    initialize,
    logout: vi.fn(),
    setNavigateToLogin: vi.fn(),
    status: 'authenticated',
    user: { email: 'user@example.com', id: 'user-id', name: 'User' },
  }
}

function createTestRouter(child: () => ReactElement, session: SessionService) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  })
  const protectedRoute = createRoute({
    beforeLoad: ({ context }) => context.session.initialize(),
    component: () => (
      <>
        <header>Header</header>
        <Outlet />
      </>
    ),
    getParentRoute: () => rootRoute,
    path: '/protected',
  })
  const childRoute = createRoute({
    component: child,
    getParentRoute: () => protectedRoute,
    path: '/child',
  })
  const routeTree = rootRoute.addChildren([
    protectedRoute.addChildren([childRoute]),
  ])
  const queryClient = new QueryClient()

  const router = createRouter({
    context: {
      permissionChecker: { can: () => true },
      queryClient,
      session,
    },
    history: createMemoryHistory({ initialEntries: ['/protected/child'] }),
    isServer: false,
    routeTree,
    ...routerDefaults,
  })
  router.startTransition = (transition) => {
    transition()
    return Promise.resolve(true)
  }
  return router
}

async function renderRouter(router: ReturnType<typeof createTestRouter>) {
  router.updateLatestLocation()
  try {
    await router.load({ sync: true })
  } catch {
    // RouteError is rendered by RouterProvider after the failed load.
  }
  return render(<RouterProvider router={router} />)
}

describe('global route error handling', () => {
  it('preserves the Header for a child route render error and recovers', async () => {
    vi.stubEnv('DEV', false)
    const shouldThrow = vi.fn().mockReturnValue(true)
    const router = createTestRouter(
      () => {
        if (shouldThrow()) throw new Error('render failure')
        return <p>Recovered page</p>
      },
      createSession(() => Promise.resolve())
    )

    await renderRouter(router)

    expect(await screen.findByText('Header')).toBeInTheDocument()
    expect(
      await screen.findByText('Não foi possível concluir a operação.')
    ).toBeInTheDocument()
    expect(screen.queryByText('render failure')).not.toBeInTheDocument()

    shouldThrow.mockReturnValue(false)
    await screen
      .findByRole('button', { name: 'Tentar novamente' })
      .then((button) => button.click())

    expect(await screen.findByText('Recovered page')).toBeInTheDocument()
    expect(screen.getAllByText('Header')).toHaveLength(1)
  })

  it('retries a protected beforeLoad error without rendering its Header', async () => {
    let initializeCalls = 0
    const session = createSession(() => {
      initializeCalls += 1
      if (initializeCalls === 1) {
        return Promise.reject(
          new ApiError('offline', undefined, undefined, undefined, {
            networkError: true,
          })
        )
      }
      return Promise.resolve()
    })
    const router = createTestRouter(() => <p>Protected page</p>, session)

    await renderRouter(router)

    expect(
      await screen.findByText('Não foi possível conectar ao servidor.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Header')).not.toBeInTheDocument()

    const retry = await screen.findByRole('button', {
      name: 'Tentar novamente',
    })
    retry.click()

    await waitFor(() =>
      expect(screen.getByText('Protected page')).toBeInTheDocument()
    )
    expect(initializeCalls).toBe(2)
  })
})
