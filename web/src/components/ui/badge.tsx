import { cn } from 'cn'
import type { HTMLAttributes } from 'react'

export function Badge({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}) {
  const variants = {
    default: 'border-transparent bg-primary text-primary-foreground',
    destructive:
      'border-transparent bg-destructive text-destructive-foreground',
    outline: 'border-border text-foreground',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
