import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { denyAllPermissions } from './auth/permissions'
import { createSessionService } from './auth/session'
import './globals.css'
import { sanitizeInternalRedirect } from './auth/redirect'
import { routeTree } from './route-tree.gen'

const session = createSessionService()

const router = createRouter({
  context: {
    permissionChecker: denyAllPermissions,
    session,
  },
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
    <RouterProvider router={router} />
  </StrictMode>
)
