import { GearIcon, SignOutIcon, UserCircleIcon } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import type { NotificationData } from '@/components/notification-bell'
import { NotificationBell } from '@/components/notification-bell'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AppRoute } from '@/lib/navigation'

interface HeaderProps extends React.ComponentProps<'header'> {
  accountTo?: AppRoute
  notifications?: NotificationData[]
  onAccountSettings?: () => void | Promise<void>
  onLogout?: () => void | Promise<void>
  onMarkNotificationRead?: (id: string) => void | Promise<void>
  onOpenNotification?: (notification: NotificationData) => void
  userEmail?: string
  userName?: string
}

export function Header({
  accountTo,
  notifications,
  onAccountSettings,
  onLogout,
  onMarkNotificationRead,
  onOpenNotification,
  userEmail = 'E-mail não informado',
  userName = 'Usuário',
  className,
  ...props
}: HeaderProps) {
  const [logoutError, setLogoutError] = useState<string>()
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const logout = useCallback(async () => {
    setLogoutError(undefined)
    setLoggingOut(true)
    try {
      await onLogout?.()
      setLogoutDialogOpen(false)
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : 'Não foi possível sair.'
      )
    } finally {
      setLoggingOut(false)
    }
  }, [onLogout])
  const openLogoutDialog = useCallback(() => setLogoutDialogOpen(true), [])
  const closeLogoutDialog = useCallback(() => setLogoutDialogOpen(false), [])

  return (
    <header className={cnHeader(className)} {...props}>
      <div className='mx-auto flex min-h-14 max-w-7xl items-center gap-4 px-6'>
        <Link
          className='shrink-0 font-bold font-mono text-lg text-primary tracking-widest'
          to='/'
        >
          ROOTLY
        </Link>

        <div className='flex-1' />

        <div className='flex items-center gap-1'>
          <NotificationBell
            notifications={notifications}
            onMarkRead={onMarkNotificationRead}
            onOpen={onOpenNotification}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Abrir menu de ${userName}`}
                className='rounded-full'
                size='icon'
                variant='ghost'
              >
                <UserCircleIcon aria-hidden='true' size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-56'>
              <div className='flex flex-col gap-0.5 px-2 py-1.5'>
                <span className='font-mono font-semibold text-foreground text-sm'>
                  {userName}
                </span>
                <span className='text-muted-foreground text-xs'>
                  {userEmail}
                </span>
              </div>
              <DropdownMenuSeparator />
              {accountTo ? (
                <DropdownMenuItem asChild>
                  <Link
                    className='flex w-full items-center gap-2'
                    to={accountTo}
                  >
                    <GearIcon aria-hidden='true' size={14} />
                    Configurações da conta
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <button
                    className='flex w-full items-center gap-2'
                    onClick={onAccountSettings}
                    type='button'
                  >
                    <GearIcon aria-hidden='true' size={14} />
                    Configurações da conta
                  </button>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={openLogoutDialog}
                variant='destructive'
              >
                <SignOutIcon aria-hidden='true' size={14} />
                Sair da conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog onOpenChange={setLogoutDialogOpen} open={logoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sair da conta</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja sair? Você precisará entrar novamente
              para acessar o sistema.
            </DialogDescription>
          </DialogHeader>
          {logoutError ? (
            <p className='text-destructive text-xs'>{logoutError}</p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={loggingOut}
              onClick={closeLogoutDialog}
              variant='outline'
            >
              Cancelar
            </Button>
            <Button
              disabled={loggingOut}
              loading={loggingOut}
              onClick={logout}
              variant='destructive'
            >
              Sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}

function cnHeader(className?: string) {
  return `sticky top-0 z-10 border-border border-b bg-background/90 backdrop-blur-sm ${className ?? ''}`
}

export type { HeaderProps }
