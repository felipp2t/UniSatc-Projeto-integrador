import type { ReactNode } from 'react'

interface EmptyStateProps {
  action?: ReactNode
  description?: string
  icon?: ReactNode
  title: string
  variant?: 'default' | 'compact'
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-md border border-border border-dashed text-center ${variant === 'compact' ? 'px-4 py-6' : 'px-6 py-12'}`}
    >
      {!!icon && <div className='text-muted-foreground'>{icon}</div>}
      <h3 className='font-display font-semibold text-sm'>{title}</h3>
      {!!description && (
        <p className='max-w-sm text-muted-foreground text-sm'>{description}</p>
      )}
      {action}
    </div>
  )
}
