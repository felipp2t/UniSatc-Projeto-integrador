import { Settings, Shield, UsersRound } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Separator } from '@/components/ui/separator'

export function WorkspaceSettingsNavigation({
  canManageGroups,
  canManageRoles,
}: {
  canManageGroups: boolean
  canManageRoles: boolean
}) {
  const sections = [
    { icon: Settings, label: 'Geral', to: '/configuracoes/geral' },
    { icon: UsersRound, label: 'Membros', to: '/configuracoes' },
    ...(canManageRoles
      ? [
          {
            icon: Shield,
            label: 'Cargos',
            to: '/configuracoes/cargos',
          },
        ]
      : []),
    ...(canManageGroups
      ? [
          {
            icon: UsersRound,
            label: 'Times',
            to: '/configuracoes/grupo',
          },
        ]
      : []),
  ] as const

  return (
    <>
      <nav
        aria-label='Configurações do workspace'
        className='flex w-full flex-row gap-1 md:w-52 md:shrink-0 md:flex-col'
      >
        {sections.map(({ icon: Icon, label, to }) => (
          <Link
            activeOptions={{ exact: true }}
            activeProps={{
              className: 'border-primary bg-primary/10 text-primary',
            }}
            className='flex items-center gap-2.5 border-l-2 px-3 py-2 font-mono font-semibold text-xs uppercase tracking-wide transition-colors'
            inactiveProps={{
              className:
                'border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground',
            }}
            key={to}
            to={to}
          >
            <Icon aria-hidden='true' className='size-3.5 shrink-0' />
            {label}
          </Link>
        ))}
      </nav>
      <Separator className='hidden h-auto md:block' orientation='vertical' />
    </>
  )
}
