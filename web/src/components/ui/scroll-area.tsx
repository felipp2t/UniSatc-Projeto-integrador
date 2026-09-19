import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

export function ScrollArea({
  className,
  children,
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      className={['relative rounded-md', className].filter(Boolean).join(' ')}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className='size-full rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring'>
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

export function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      className={[
        'flex touch-none select-none p-px transition-colors',
        'data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2.5 data-[orientation=vertical]:border-l data-[orientation=vertical]:border-l-transparent',
        'data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-t-transparent',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className='relative flex-1 rounded-full bg-border' />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}
