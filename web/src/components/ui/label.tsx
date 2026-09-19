import type { LabelHTMLAttributes } from 'react'
import { cn } from 'cn'

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: The control association is supplied through htmlFor.
    <label
      className={cn(
        'flex select-none items-center gap-2 font-medium font-mono text-xs leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
