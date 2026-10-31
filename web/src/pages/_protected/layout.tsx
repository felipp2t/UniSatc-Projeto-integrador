import { queryOptions } from '@tanstack/react-query'
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useCallback } from 'react'
import { workspaceApi } from '@/api/endpoints'
import {
  createPermissionChecker,
  enforceRoutePermission,
  workspacePermissionQueryKey,
} from '@/auth/permissions'
import { sanitizeInternalRedirect } from '@/auth/redirect'
import { Header } from '@/components/header'
import { NotFoundPage } from '@/components/not-found-page'
import { OfflineBanner } from '@/components/offline-banner'
import { GridPattern } from '@/components/ui/grid-pattern'
import { ScrollArea } from '@/components/ui/scroll-area'

const workspacesQuery = queryOptions({
  queryFn: async () => (await workspaceApi.list()).data,
  queryKey: ['workspaces'],
})

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

    if (!matches.some((match) => match.staticData.permission)) return

    const [workspace] =
      await context.queryClient.ensureQueryData(workspacesQuery)
    const workspaceId = workspace?.id
    if (!workspaceId) return
    const permissions = await context.queryClient.ensureQueryData({
      queryFn: async () =>
        (await workspaceApi.myPermissions(workspaceId)).data.permissions,
      queryKey: workspacePermissionQueryKey(workspaceId),
    })
    enforceRoutePermission(matches, createPermissionChecker(permissions))
  },
  component: ProtectedLayout,
  notFoundComponent: NotFoundPage,
})

function ProtectedLayout() {
  const { session } = Route.useRouteContext()
  const navigate = useNavigate()

  const handleLogout = useCallback(async () => {
    await session.logout()
    await navigate({
      replace: true,
      search: { redirect: undefined },
      to: '/login',
    })
  }, [navigate, session])

  return (
    <div className='relative h-svh'>
      <GridPattern />
      <div className='relative z-10 flex h-full flex-col bg-background/80'>
        <Header
          accountTo='/configuracoes'
          onLogout={handleLogout}
          userEmail={session.user?.email}
          userName={session.user?.name}
        />
        <OfflineBanner />
        <div className='flex min-h-0 flex-1 overflow-hidden'>
          <ScrollArea className='flex-1'>
            <Outlet />
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
