import { UserGearIcon, UserIcon } from '@phosphor-icons/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { ChangePasswordForm } from '@/components/change-password-form'
import { Separator } from '@/components/ui/separator'

export const Route = createFileRoute('/_protected/configuracoes')({
  component: AccountSettingsPage,
  head: () => ({ meta: [{ title: 'Configurações da conta | Vaulty' }] }),
})

function AccountSettingsPage() {
  return (
    <main className='container mx-auto space-y-6 px-8 py-12'>
      <header className='flex flex-col gap-6'>
        <AppBreadcrumb
          items={[{ label: 'Início', to: '/' }, { label: 'Conta' }]}
        />
        <div className='flex items-center gap-4'>
          <UserGearIcon
            aria-hidden='true'
            className='size-6 shrink-0 text-primary'
          />
          <h1 className='font-bold font-mono text-3xl'>CONTA</h1>
        </div>
      </header>

      <div className='flex min-w-0 flex-col gap-8 sm:flex-row'>
        <nav
          aria-label='Configurações da conta'
          className='flex w-full shrink-0 flex-col gap-1 sm:w-52'
        >
          <Link
            activeProps={{
              className: 'border-primary bg-primary/10 text-primary',
            }}
            className='flex cursor-pointer items-center gap-2.5 border-l-2 px-3 py-2 text-left font-mono font-semibold text-xs uppercase tracking-wide transition-colors'
            inactiveProps={{
              className:
                'border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground',
            }}
            to='/configuracoes'
          >
            <UserIcon aria-hidden='true' className='size-3.5 shrink-0' />
            Perfil
          </Link>
        </nav>

        <Separator className='hidden h-auto sm:block' orientation='vertical' />
        <Separator className='sm:hidden' />

        <div className='min-w-0 flex-1'>
          <div className='max-w-md'>
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </main>
  )
}
