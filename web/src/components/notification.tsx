import { cn } from 'cn'
export function NotificationRoot({
  className,
  ...props
}: React.ComponentProps<'article'>) {
  return (
    <article
      className={cn('border border-border bg-card p-4', className)}
      {...props}
    />
  )
}
export function NotificationHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3', className)}
      {...props}
    />
  )
}
export function NotificationIndicator({ show = true }: { show?: boolean }) {
  return show ? (
    <span
      aria-label='Não lida'
      className='size-2 rounded-full bg-primary'
      role='status'
    />
  ) : null
}
export function NotificationTitle({
  className,
  ...props
}: React.ComponentProps<'h3'>) {
  return <h3 className={cn('font-medium text-sm', className)} {...props} />
}
export function NotificationContent({
  className,
  ...props
}: React.ComponentProps<'p'>) {
  return (
    <p
      className={cn('mt-2 text-muted-foreground text-xs', className)}
      {...props}
    />
  )
}
export function NotificationActions({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return <div className={cn('mt-3 flex gap-2', className)} {...props} />
}
export function NotificationAction({
  className,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      className={cn(
        'text-primary text-xs underline underline-offset-2',
        className
      )}
      type='button'
      {...props}
    />
  )
}
