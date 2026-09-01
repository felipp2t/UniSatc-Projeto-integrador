import { createRootRoute, HeadContent, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
})

function RootComponent() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  )
}

function NotFoundComponent() {
  return (
    <div className='flex min-h-svh items-center justify-center'>
      <div className='text-center'>
        <h1 className='font-bold text-6xl'>404</h1>
        <p className='mt-4 text-muted-foreground text-xl'>
          Página não encontrada
        </p>
      </div>
    </div>
  )
}
