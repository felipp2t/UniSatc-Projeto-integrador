import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createSessionService } from './auth/session'
import { AccentProvider } from './lib/accent'
import './globals.css'
import { createQueryClient } from './api/query-client'
import { sanitizeInternalRedirect } from './auth/redirect'
import { routerDefaults } from './config/routes/router-defaults'
import { syncOnlineStatus } from './hooks/use-online-status'
import { routeTree } from './route-tree.gen'

const session = createSessionService()
const queryClient = createQueryClient()
syncOnlineStatus()

const router = createRouter({
  context: {
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
      <AccentProvider>
        <RouterProvider router={router} />
      </AccentProvider>
    </QueryClientProvider>
  </StrictMode>
)
