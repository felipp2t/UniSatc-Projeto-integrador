import { XIcon } from '@phosphor-icons/react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { Button } from './button'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={['fixed inset-0 z-50 bg-black/70', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

export function DialogContent({
  children,
  className,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={[
          'fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-md border border-border bg-card p-6 text-foreground shadow-lg outline-none',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
        {!!showCloseButton && (
          <DialogPrimitive.Close asChild>
            <Button
              aria-label='Close'
              className='absolute top-3 right-3 text-muted-foreground hover:text-foreground'
              size='icon'
              variant='ghost'
            >
              <XIcon size={14} />
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={['flex items-center justify-end gap-2', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={['font-bold font-mono text-sm', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={['font-mono text-muted-foreground text-xs', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}
