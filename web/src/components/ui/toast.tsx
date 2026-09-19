import {
  Toaster as Sonner,
  type ToasterProps as SonnerProps,
  toast,
} from 'sonner'

export const appToast = toast

export function Toaster({
  toastOptions,
  visibleToasts = 5,
  ...props
}: SonnerProps) {
  return (
    <Sonner
      closeButton
      expand={false}
      position='bottom-right'
      toastOptions={{
        classNames: {
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
          description: 'text-muted-foreground text-xs',
          title: 'font-semibold text-xs',
          toast: 'border-border bg-popover font-mono text-popover-foreground',
        },
        ...toastOptions,
      }}
      visibleToasts={visibleToasts}
      {...props}
    />
  )
}
