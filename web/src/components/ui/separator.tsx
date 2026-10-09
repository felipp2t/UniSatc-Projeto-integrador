import { cn } from 'cn'
import type { HTMLAttributes } from 'react'

export interface SeparatorProps extends HTMLAttributes<HTMLHRElement> {
  decorative?: boolean
  orientation?: 'horizontal' | 'vertical'
}

export function Separator({
  className,
  decorative = true,
  orientation = 'horizontal',
  ...props
}: SeparatorProps) {
  const isHorizontal = orientation === 'horizontal'
  const classes = cn(
    'shrink-0 bg-border',
    isHorizontal ? 'h-px w-full' : 'h-full w-px',
    className
  )

  return (
    <hr
      aria-hidden={decorative ? true : undefined}
      className={classes}
      {...props}
    />
  )
}
