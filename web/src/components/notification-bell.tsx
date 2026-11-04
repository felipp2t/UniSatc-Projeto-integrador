import { BellIcon, CheckIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { notificationsApi } from '@/api/endpoints'
import { notificationKeys } from '@/api/notification-keys'
import type { NotificationResponse } from '@/api/types'
import {
  NotificationContent,
  NotificationHeader,
  NotificationIndicator,
  NotificationRoot,
  NotificationTitle,
} from '@/components/notification'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { appToast } from '@/components/ui/toast'
import { useNotificationRead } from '@/hooks/use-notification-read'
import { getNotificationHref } from '@/lib/notification-navigation'

const PAGE_SIZE = 10

export type NotificationData = NotificationResponse

interface NotificationBellProps {
  notifications?: NotificationData[]
  onMarkAllRead?: () => void | Promise<void>
  onMarkRead?: (id: string) => void | Promise<void>
  onOpen?: (notification: NotificationData) => void
}

export function NotificationBell({
  notifications: suppliedNotifications,
  onMarkAllRead,
  onMarkRead,
  onOpen,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const { markAllRead, markRead } = useNotificationRead()
  const query = useQuery({
    enabled: suppliedNotifications === undefined,
    queryFn: async () => (await notificationsApi.list(page, PAGE_SIZE)).data,
    queryKey: notificationKeys.page(page),
  })
  const notifications = suppliedNotifications ?? query.data?.notifications ?? []
  const unreadCount =
    suppliedNotifications === undefined
      ? (query.data?.unreadCount ?? 0)
      : suppliedNotifications.filter((notification) => !isRead(notification))
          .length
  const unreadBadge = unreadCount > 99 ? '99+' : String(unreadCount)
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) setPage(0)
  }, [])
  const handleRetry = useCallback(async () => {
    await query.refetch()
  }, [query.refetch])
  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      try {
        if (onMarkRead) await onMarkRead(notificationId)
        else await markRead.mutateAsync(notificationId)
      } catch {
        appToast.error('Não foi possível marcar a notificação como lida.')
      }
    },
    [markRead.mutateAsync, onMarkRead]
  )
  const handleMarkAllRead = useCallback(async () => {
    try {
      if (onMarkAllRead) await onMarkAllRead()
      else await markAllRead.mutateAsync()
    } catch {
      appToast.error('Não foi possível marcar as notificações como lidas.')
    }
  }, [markAllRead.mutateAsync, onMarkAllRead])
  const handlePreviousPage = useCallback(
    () => setPage((current) => current - 1),
    []
  )
  const handleNextPage = useCallback(
    () => setPage((current) => current + 1),
    []
  )

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={`Notificações: ${unreadCount} não lidas`}
          className='relative'
          size='icon'
          variant='ghost'
        >
          <BellIcon aria-hidden='true' size={18} />
          {unreadCount > 0 ? (
            <span className='absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] text-primary-foreground'>
              {unreadBadge}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-80 p-3'>
        <PopoverHeader>
          <PopoverTitle>Notificações</PopoverTitle>
          <p className='text-muted-foreground text-xs'>
            {unreadCount} não lidas
          </p>
        </PopoverHeader>
        {unreadCount > 0 && suppliedNotifications === undefined ? (
          <Button
            className='mt-2 w-full justify-start'
            onClick={handleMarkAllRead}
            size='sm'
            variant='ghost'
          >
            <CheckIcon aria-hidden='true' size={16} />
            Marcar todas como lidas
          </Button>
        ) : null}
        <ScrollArea className='mt-3 max-h-80'>
          <NotificationListContent
            error={query.error}
            isError={query.isError && suppliedNotifications === undefined}
            isLoading={query.isLoading && suppliedNotifications === undefined}
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onOpen={onOpen}
            onRetry={handleRetry}
          />
        </ScrollArea>
        {suppliedNotifications === undefined && query.data ? (
          <div className='mt-2 flex items-center justify-between border-border border-t pt-2'>
            <Button
              disabled={page === 0 || query.isFetching}
              onClick={handlePreviousPage}
              size='sm'
              variant='ghost'
            >
              Anteriores
            </Button>
            <span className='text-muted-foreground text-xs'>
              {query.data.totalPages === 0 ? 0 : page + 1} /{' '}
              {query.data.totalPages}
            </span>
            <Button
              disabled={page + 1 >= query.data.totalPages || query.isFetching}
              onClick={handleNextPage}
              size='sm'
              variant='ghost'
            >
              Próximas
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function NotificationListContent({
  error,
  isError,
  isLoading,
  notifications,
  onMarkRead,
  onOpen,
  onRetry,
}: {
  error: Error | null
  isError: boolean
  isLoading: boolean
  notifications: NotificationData[]
  onMarkRead: (id: string) => void | Promise<void>
  onOpen?: NotificationBellProps['onOpen']
  onRetry: () => Promise<void>
}) {
  if (isLoading) return <LoadingState label='Carregando notificações...' />
  if (isError) {
    return <ErrorState error={error} onRetry={onRetry} variant='compact' />
  }
  if (notifications.length === 0) {
    return (
      <p className='px-2 py-6 text-center text-muted-foreground text-xs'>
        Nenhuma notificação.
      </p>
    )
  }
  return notifications.map((notification) => (
    <NotificationRow
      key={notification.id}
      notification={notification}
      onMarkRead={onMarkRead}
      onOpen={onOpen}
    />
  ))
}

function NotificationRow({
  notification,
  onMarkRead,
  onOpen,
}: {
  notification: NotificationData
  onMarkRead?: (id: string) => void | Promise<void>
  onOpen?: NotificationBellProps['onOpen']
}) {
  const handleOpen = useCallback(async () => {
    if (!isRead(notification)) await onMarkRead?.(notification.id)
    onOpen?.(notification)
  }, [notification, onMarkRead, onOpen])
  const handleMarkRead = useCallback(
    () => onMarkRead?.(notification.id),
    [notification.id, onMarkRead]
  )
  const content = (
    <NotificationRoot className='mb-2 p-3'>
      <NotificationHeader>
        <NotificationTitle>{notification.title}</NotificationTitle>
        <NotificationIndicator show={!isRead(notification)} />
      </NotificationHeader>
      <NotificationContent>{notification.content}</NotificationContent>
      <time
        className='mt-2 block text-[11px] text-muted-foreground'
        dateTime={notification.createdAt}
      >
        {formatRelativeTime(notification.createdAt)}
      </time>
    </NotificationRoot>
  )
  const href = getNotificationHref(notification.metadata)

  if (!href) {
    return (
      <div>
        {content}
        {isRead(notification) ? null : (
          <Button
            className='mb-2'
            onClick={handleMarkRead}
            size='sm'
            variant='ghost'
          >
            <CheckIcon aria-hidden='true' size={16} />
            Marcar como lida
          </Button>
        )}
      </div>
    )
  }

  return (
    <Link
      className='block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
      onClick={handleOpen}
      to={href}
    >
      {content}
    </Link>
  )
}

function isRead(notification: NotificationData) {
  return notification.readAt !== null
}

function formatRelativeTime(createdAt: string) {
  const timestamp = new Date(createdAt).getTime()
  if (Number.isNaN(timestamp)) return ''

  const seconds = Math.round((timestamp - Date.now()) / 1000)
  const absoluteSeconds = Math.abs(seconds)
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    absoluteSeconds < 60
      ? [seconds, 'second']
      : absoluteSeconds < 3600
        ? [Math.round(seconds / 60), 'minute']
        : absoluteSeconds < 86_400
          ? [Math.round(seconds / 3600), 'hour']
          : [Math.round(seconds / 86_400), 'day']

  return new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(
    value,
    unit
  )
}

export type { NotificationBellProps }
