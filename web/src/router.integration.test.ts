import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import {
  enforceRoutePermission,
  type PermissionChecker,
} from '@/auth/permissions'
import type { SessionService, SessionStatus } from '@/auth/session'
import { Route as ProtectedSplatRoute } from './pages/_protected/$'
import { routeTree } from './route-tree.gen'
import type { RouterContext } from './router-context'

vi.stubGlobal('window', {
  location: { origin: 'http://localhost' },
  origin: 'http://localhost',
})

function createSession(
  status: SessionStatus,
  initializeError?: ApiError
): SessionService {
  return {
    dispose: vi.fn(),
    handleSessionExpired: vi.fn(),
    initialize: vi.fn(() =>
      initializeError ? Promise.reject(initializeError) : Promise.resolve()
    ),
    setNavigateToLogin: vi.fn(),
    status,
    user:
      status === 'authenticated'
        ? { email: 'user@example.com', id: 'user-id', name: 'User' }
        : undefined,
  }
}

function createApplicationRouter(
  initialEntry: string,
  sessionStatus: SessionStatus,
  initializeError?: ApiError
) {
  const session = createSession(sessionStatus, initializeError)
  const history = createMemoryHistory({ initialEntries: [initialEntry] })
  const router = createRouter({
    context: {
      permissionChecker: { can: () => true },
      session,
    },
    history,
    isServer: false,
    routeTree,
  })
  router.startTransition = (transition) => {
    transition()
    return Promise.resolve(true)
  }

  return { router, session }
}

async function loadRouter(
  router: ReturnType<typeof createApplicationRouter>['router']
) {
  try {
    router.updateLatestLocation()
    await router.load({ sync: true })
  } catch {
    // Redirects and notFound errors are asserted through router state below.
  }
}

describe('application router guards', () => {
  it.each(['/', '/components', '/unknown', '/convite', '/convite/a/b'])(
    'redirects unauthenticated navigation from %s to login',
    async (initialEntry) => {
      const { router } = createApplicationRouter(
        initialEntry,
        'unauthenticated'
      )

      await loadRouter(router)

      expect(router.state.location.pathname).toBe('/login')
    }
  )

  it('preserves the internal destination through the login redirect', async () => {
    const { router } = createApplicationRouter(
      '/components?tab=all#overview',
      'unauthenticated'
    )

    await loadRouter(router)

    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toEqual({
      redirect: '/components?tab=all#overview',
    })
  })

  it.each([
    '/login',
    '/convite/invite-token',
    '/esqueci-senha',
    '/redefinir-senha',
  ])(
    'keeps public route %s accessible without a session',
    async (initialEntry) => {
      const { router } = createApplicationRouter(
        initialEntry,
        'unauthenticated'
      )

      await loadRouter(router)

      expect(router.state.location.pathname).toBe(initialEntry)
    }
  )

  it('does not redirect transient session errors to login', async () => {
    const error = new ApiError('Serviço indisponível', 503)
    const { router } = createApplicationRouter('/components', 'error', error)

    await loadRouter(router)

    expect(router.state.location.pathname).toBe('/components')
    expect(router.state.location.pathname).not.toBe('/login')
  })

  it('uses the protected splat for unknown URLs', () => {
    const { router } = createApplicationRouter('/unknown', 'authenticated')

    expect(
      router
        .matchRoutes('/unknown')
        .some((match) => match.routeId === '/_protected/$')
    ).toBe(true)
  })

  it('throws notFound from the protected splat beforeLoad', () => {
    expect(() =>
      ProtectedSplatRoute.options.beforeLoad?.({} as never)
    ).toThrow()
  })

  it.each(['/components', '/'])(
    'prioritizes the static route %s over the protected splat',
    (initialEntry) => {
      const { router } = createApplicationRouter(initialEntry, 'authenticated')

      expect(
        router
          .matchRoutes(initialEntry)
          .some((match) => match.routeId === '/_protected/$')
      ).toBe(false)
    }
  )
})

function createPermissionRouter(checker: PermissionChecker) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => null,
  })
  const protectedRoute = createRoute({
    beforeLoad: ({ context, matches }) =>
      enforceRoutePermission(
        matches as Parameters<typeof enforceRoutePermission>[0],
        context.permissionChecker
      ),
    component: () => null,
    getParentRoute: () => rootRoute,
    id: 'protected',
  })
  const restrictedRoute = createRoute({
    component: () => null,
    getParentRoute: () => protectedRoute,
    path: '/restricted',
    staticData: {
      permission: { action: 'read', resource: 'workspace' },
    },
  })
  const testRouteTree = rootRoute.addChildren([
    protectedRoute.addChildren([restrictedRoute]),
  ])

  const router = createRouter({
    context: {
      permissionChecker: checker,
      session: createSession('authenticated'),
    },
    history: createMemoryHistory({ initialEntries: ['/restricted'] }),
    isServer: false,
    routeTree: testRouteTree,
  })
  router.startTransition = (transition) => {
    transition()
    return Promise.resolve(true)
  }
  return router
}

describe('permission guard router integration', () => {
  it('allows a route when the checker grants its permission', async () => {
    const checker: PermissionChecker = { can: vi.fn().mockReturnValue(true) }
    const router = createPermissionRouter(checker)

    router.updateLatestLocation()
    await router.load({ sync: true })

    expect(router.state.location.pathname).toBe('/restricted')
    expect(checker.can).toHaveBeenCalledWith('workspace', 'read')
  })

  it('returns notFound when the checker denies its permission', async () => {
    const checker: PermissionChecker = { can: vi.fn().mockReturnValue(false) }
    const router = createPermissionRouter(checker)

    router.updateLatestLocation()
    await router.load({ sync: true })
    const deniedMatch = router.state.matches.find((match) =>
      Boolean(match.staticData.permission)
    )
    expect(deniedMatch?.status).toBe('notFound')
    expect(deniedMatch?.error).toMatchObject({ isNotFound: true })
    expect(checker.can).toHaveBeenCalledWith('workspace', 'read')
  })
})
