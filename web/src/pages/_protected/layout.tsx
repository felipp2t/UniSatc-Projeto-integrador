import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { enforceRoutePermission } from '@/auth/permissions'
import { sanitizeInternalRedirect } from '@/auth/redirect'
import { Header } from '@/components/header'
import { NotFoundPage } from '@/components/not-found-page'
import { GridPattern } from '@/components/ui/grid-pattern'
import { ScrollArea } from '@/components/ui/scroll-area'

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ context, location, matches }) => {
    await context.session.initialize()

    if (context.session.status !== 'authenticated') {
      throw redirect({
        search: {
          redirect: sanitizeInternalRedirect(location.href),
        },
        to: '/login',
      })
    }

    enforceRoutePermission(matches, context.permissionChecker)
  },
  component: ProtectedLayout,
  notFoundComponent: NotFoundPage,
})

function ProtectedLayout() {
  return (
    <div className='relative h-svh'>
      <GridPattern />
      <div className='relative z-10 flex h-full flex-col bg-background/80'>
        <Header />
        <div className='flex min-h-0 flex-1 overflow-hidden'>
          <ScrollArea className='flex-1'>
            <Outlet />
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
