import type { ReactNode } from 'react'

interface EmptyStateProps {
  action?: ReactNode
  description?: string
  icon?: ReactNode
  title: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className='flex flex-col items-center justify-center gap-3 rounded-md border border-border border-dashed px-6 py-12 text-center'>
      {!!icon && <div className='text-muted-foreground'>{icon}</div>}
      <h3 className='font-display font-semibold text-sm'>{title}</h3>
      {!!description && (
        <p className='max-w-sm text-muted-foreground text-sm'>{description}</p>
      )}
      {action}
    </div>
  )
}
