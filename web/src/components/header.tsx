import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'

interface HeaderProps extends React.ComponentProps<'header'> {
  accountHref?: string
  homeHref?: string
  onLogout?: () => void | Promise<void>
  settingsHref?: string
  userName?: string
}
export function Header({
  homeHref = '/',
  accountHref = '#',
  settingsHref = '#',
  userName = 'U',
  onLogout,
  className,
  ...props
}: HeaderProps) {
  const [logoutError, setLogoutError] = useState<string>()
  const logout = useCallback(async () => {
    setLogoutError(undefined)
    try {
      await onLogout?.()
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : 'Não foi possível sair.'
      )
    }
  }, [onLogout])
  return (
    <header
      className={`sticky top-0 z-10 border-border border-b bg-background/90 backdrop-blur-sm ${className ?? ''}`}
      {...props}
    >
      <div className='mx-auto flex h-14 max-w-7xl items-center gap-4 px-6'>
        <a
          className='font-bold font-mono text-lg text-primary tracking-widest'
          href={homeHref}
        >
          UNISATC
        </a>
        <div className='flex-1' />
        <a
          className='text-muted-foreground text-sm hover:text-foreground'
          href={settingsHref}
        >
          Configurações
        </a>
        <a
          className='flex size-8 items-center justify-center rounded-full bg-accent font-medium text-accent-foreground'
          href={accountHref}
        >
          {userName.slice(0, 1).toUpperCase()}
        </a>
        {onLogout ? (
          <Button onClick={logout} size='sm' variant='ghost'>
            Sair
          </Button>
        ) : null}
      </div>
      {logoutError ? (
        <p className='mx-auto max-w-7xl px-6 pb-2 text-destructive text-xs'>
          {logoutError}
        </p>
      ) : null}
    </header>
  )
}
export type { HeaderProps }
