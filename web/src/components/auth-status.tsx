import { FolderIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface AuthStatusProps {
  action?: () => void
  actionLabel?: string
  message: string
  title: string
}

export function AuthStatus({
  action,
  actionLabel,
  message,
  title,
}: AuthStatusProps) {
  return (
    <main className='flex min-h-svh items-center justify-center bg-background p-6'>
      <section
        aria-labelledby='auth-status-title'
        className='flex w-full max-w-sm flex-col items-center gap-6 text-center'
      >
        <BrandMark />
        <div className='flex flex-col gap-2'>
          <h1
            className='font-bold font-display text-2xl'
            id='auth-status-title'
          >
            {title}
          </h1>
          <p className='text-muted-foreground text-sm'>{message}</p>
        </div>
        {action && actionLabel ? (
          <Button onClick={action} type='button'>
            {actionLabel}
          </Button>
        ) : null}
      </section>
    </main>
  )
}

export function BrandMark() {
  return (
    <div
      aria-label='Vaulty'
      className='flex size-10 items-center justify-center rounded-md text-foreground'
      role='img'
    >
      <FolderIcon aria-hidden='true' size={28} />
    </div>
  )
}
