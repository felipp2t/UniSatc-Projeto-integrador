import { createFileRoute } from '@tanstack/react-router'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { NotFoundPage } from '@/components/not-found-page'

export const Route = createFileRoute('/_protected/')({
  component: HomePage,
  head: () => ({
    meta: [{ title: 'web' }],
  }),
  notFoundComponent: NotFoundPage,
})

function HomePage() {
  return (
    <main className='mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 px-6 py-12'>
      <AppBreadcrumb items={[{ label: 'Início' }]} />
      <h1 className='font-bold font-display text-4xl tracking-tight'>Início</h1>
    </main>
  )
}
