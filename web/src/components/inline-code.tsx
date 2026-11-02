import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'

interface InlineCodeRootProps extends ComponentProps<'div'> {
  children: ReactNode
}

export function InlineCodeRoot({
  children,
  className,
  ...props
}: InlineCodeRootProps) {
  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      {children}
    </div>
  )
}

interface InlineCodeContentProps extends ComponentProps<'div'> {
  children: ReactNode
}

export function InlineCodeContent({
  children,
  className,
  ...props
}: InlineCodeContentProps) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface InlineCodeTextProps extends ComponentProps<'p'> {
  children: ReactNode
}

export function InlineCodeText({
  children,
  className,
  ...props
}: InlineCodeTextProps) {
  return (
    <p
      className={cn(
        'font-bold font-mono text-muted-foreground text-xs uppercase',
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
}

interface InlineCodeAddonProps extends ComponentProps<'p'> {
  children: ReactNode
}

export function InlineCodeAddon({
  children,
  className,
  ...props
}: InlineCodeAddonProps) {
  return (
    <p
      className={cn(
        'font-bold font-mono text-muted-foreground text-xs uppercase',
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
}

interface InlineCodeSeparatorProps extends ComponentProps<'p'> {}

export function InlineCodeSeparator({
  className,
  ...props
}: InlineCodeSeparatorProps) {
  return (
    <p
      aria-hidden='true'
      className={cn(
        'px-1 font-bold font-mono text-[#2f2f2f] text-xs',
        className
      )}
      {...props}
    >
      /
    </p>
  )
}
