import { cn } from 'cn'
import { Popover as PopoverPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

export function PopoverContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        className={cn(
          'z-50 w-72 rounded-lg bg-popover p-4 text-popover-foreground shadow-md ring-1 ring-foreground/10',
          className
        )}
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export function PopoverHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1', className)} {...props} />
}

export function PopoverTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('font-medium text-sm', className)} {...props} />
}

export function PopoverDescription({
  className,
  ...props
}: ComponentProps<'p'>) {
  return (
    <p className={cn('text-muted-foreground text-xs', className)} {...props} />
  )
}
