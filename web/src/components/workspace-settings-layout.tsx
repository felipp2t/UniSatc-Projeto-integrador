import { GearIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { AppBreadcrumb } from '@/components/app-breadcrumb'
import { WorkspaceSettingsNavigation } from '@/components/workspace-settings-navigation'

export function WorkspaceSettingsLayout({
  breadcrumbLabel,
  breadcrumbParentLabel,
  canManageGroups,
  children,
}: {
  breadcrumbLabel: string
  breadcrumbParentLabel?: string
  canManageGroups: boolean
  children: ReactNode
}) {
  return (
    <main className='container mx-auto space-y-6 px-4 py-8 md:px-8 md:py-12'>
      <header className='flex flex-col gap-6'>
        <AppBreadcrumb
          items={[
            { label: 'Início', to: '/' },
            ...(breadcrumbParentLabel
              ? [{ label: breadcrumbParentLabel }]
              : []),
            { label: breadcrumbLabel },
          ]}
        />
        <div className='flex min-w-0 items-center gap-4'>
          <GearIcon
            aria-hidden='true'
            className='size-6 shrink-0 text-primary'
          />
          <h1 className='truncate font-bold font-mono text-xl md:text-3xl'>
            CONFIGURAÇÕES DO WORKSPACE
          </h1>
        </div>
      </header>
      <div className='flex min-w-0 flex-col gap-8 md:flex-row'>
        <WorkspaceSettingsNavigation canManageGroups={canManageGroups} />
        {children}
      </div>
    </main>
  )
}
