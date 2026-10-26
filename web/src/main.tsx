import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { denyAllPermissions } from './auth/permissions'
import { createSessionService } from './auth/session'
import './globals.css'
import { createQueryClient } from './api/query-client'
import { sanitizeInternalRedirect } from './auth/redirect'
import { syncOnlineStatus } from './hooks/use-online-status'
import { routeTree } from './route-tree.gen'
import { routerDefaults } from './router-defaults'

const session = createSessionService()
const queryClient = createQueryClient()
syncOnlineStatus()

const router = createRouter({
  context: {
    permissionChecker: denyAllPermissions,
    queryClient,
    session,
  },
  ...routerDefaults,
  defaultPreload: 'intent',
  defaultPreloadDelay: 500,
  routeTree,
})

session.setNavigateToLogin(() => {
  const { location } = router.state
  const redirect = sanitizeInternalRedirect(location.href)

  if (location.pathname === '/login') {
    return
  }

  router.navigate({
    search: { redirect },
    to: '/login',
  })
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
