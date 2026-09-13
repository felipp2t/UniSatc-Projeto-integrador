import { InformationCircleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
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
      <PopoverTrigger
        render={
          <Button aria-label='Notificações' size='icon' variant='ghost' />
        }
      >
        <HugeiconsIcon aria-hidden='true' icon={InformationCircleIcon} />
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
      // Navigation/opening must still be available when marking fails.
    }
    try {
      onOpen?.(notification)
    } catch {
      // A consumer callback must not break the notification control.
    }
  }, [notification, onMarkRead, onOpen])
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
    },
    [open]
  )
  const handleHrefClick = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      try {
        await open()
      } catch {
        // Navigation remains available even if a consumer callback fails.
      }
      window.location.assign(notification.href ?? '')
    },
    [notification.href, open]
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
      <a
        className='mb-2 block cursor-pointer'
        href={notification.href}
        onClick={handleHrefClick}
      >
        <NotificationRoot>{content}</NotificationRoot>
      </a>
    )
  }
  return (
    <NotificationRoot
      aria-label={notification.title}
      className='mb-2 cursor-pointer'
      onClick={open}
      onKeyDown={handleKeyDown}
      role='button'
      tabIndex={0}
    >
      {content}
    </NotificationRoot>
  )
}

export type { NotificationBellProps }
