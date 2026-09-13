import { cn } from 'cn'

export function InlineCodeRoot({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />
}
export function InlineCodeContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1',
        className
      )}
      {...props}
    />
  )
}
export function InlineCodeText({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('font-mono text-foreground text-xs', className)}
      {...props}
    />
  )
}
export function InlineCodeAddon({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('font-mono text-muted-foreground text-xs', className)}
      {...props}
    />
  )
}
export function InlineCodeSeparator({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('font-mono text-muted-foreground text-xs', className)}
      {...props}
    >
      /
    </span>
  )
}
