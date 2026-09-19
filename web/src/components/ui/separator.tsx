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
  const classes = [
    'shrink-0 bg-border',
    isHorizontal ? 'h-px w-full' : 'h-full w-px',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <hr
      aria-hidden={decorative ? true : undefined}
      className={classes}
      {...props}
    />
  )
}
