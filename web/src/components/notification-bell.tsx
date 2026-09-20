import { BellIcon } from '@phosphor-icons/react'
import { useCallback } from 'react'
import {
  NotificationContent,
  NotificationHeader,
  NotificationIndicator,
  NotificationRoot,
  NotificationTitle,
} from '@/components/notification'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface NotificationData {
  content: string
  href?: string
  id: string
  read?: boolean
  title: string
}
interface NotificationBellProps {
  notifications?: NotificationData[]
  onMarkRead?: (id: string) => void | Promise<void>
  onOpen?: (notification: NotificationData) => void
}

export function NotificationBell({
  notifications = [],
  onMarkRead,
  onOpen,
}: NotificationBellProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label='Notificações' size='icon' variant='ghost'>
          <BellIcon aria-hidden='true' />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Notificações</PopoverTitle>
        </PopoverHeader>
        <ScrollArea className='mt-3 max-h-72'>
          {notifications.length === 0 ? (
            <p className='text-muted-foreground text-xs'>
              Nenhuma notificação.
            </p>
          ) : (
            notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onMarkRead={onMarkRead}
                onOpen={onOpen}
              />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function NotificationRow({
  notification,
  onMarkRead,
  onOpen,
}: {
  notification: NotificationData
  onMarkRead?: NotificationBellProps['onMarkRead']
  onOpen?: NotificationBellProps['onOpen']
}) {
  const open = useCallback(async () => {
    try {
      await onMarkRead?.(notification.id)
    } catch {
      /* callback errors do not block opening */
    }
    try {
      onOpen?.(notification)
    } catch {
      /* consumer errors do not break the control */
    }
  }, [notification, onMarkRead, onOpen])
  const handleOpen = useCallback(() => {
    open().catch(() => undefined)
  }, [open])
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      handleOpen()
    },
    [handleOpen]
  )
  const content = (
    <>
      <NotificationHeader>
        <NotificationTitle>{notification.title}</NotificationTitle>
        <NotificationIndicator show={!notification.read} />
      </NotificationHeader>
      <NotificationContent>{notification.content}</NotificationContent>
    </>
  )
  if (notification.href) {
    return (
      <a className='mb-2 block' href={notification.href} onClick={handleOpen}>
        <NotificationRoot>{content}</NotificationRoot>
      </a>
    )
  }
  return (
    <NotificationRoot
      aria-label={notification.title}
      className='mb-2 cursor-pointer'
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      role='button'
      tabIndex={0}
    >
      {content}
    </NotificationRoot>
  )
}

export type { NotificationBellProps }
