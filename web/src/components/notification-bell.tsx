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
        ●
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
    await onMarkRead?.(notification.id)
    onOpen?.(notification)
  }, [notification, onMarkRead, onOpen])
  return (
    <NotificationRoot className='mb-2 cursor-pointer' onClick={open}>
      <NotificationHeader>
        <NotificationTitle>{notification.title}</NotificationTitle>
        <NotificationIndicator show={!notification.read} />
      </NotificationHeader>
      <NotificationContent>{notification.content}</NotificationContent>
    </NotificationRoot>
  )
}

export type { NotificationBellProps }
