import type { HTMLAttributes } from 'react'

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['animate-pulse rounded-sm bg-muted-foreground/15', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}
