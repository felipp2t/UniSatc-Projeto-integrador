import { cn } from 'cn'
import type { HTMLAttributes } from 'react'

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-sm bg-muted-foreground/15',
        className
      )}
      {...props}
    />
  )
}
