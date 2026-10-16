import { createFileRoute } from '@tanstack/react-router'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { CreateItemDialog } from '@/components/create-item-dialog'
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
      <header className='flex flex-wrap items-end justify-between gap-5 border-border border-b pb-6'>
        <div className='space-y-2'>
          <p className='font-mono text-[10px] text-primary uppercase tracking-[0.2em]'>
            Vaulty / Workspace
          </p>
          <h1 className='font-bold font-display text-4xl tracking-tight'>
            Início
          </h1>
          <p className='font-mono text-muted-foreground text-xs'>
            Guarde textos, links e segredos em um só lugar.
          </p>
        </div>
        <CreateItemDialog />
      </header>
    </main>
  )
}
