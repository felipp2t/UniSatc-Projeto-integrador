import { cn } from 'cn'

function ScrollArea({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('relative overflow-auto', className)}
      data-slot='scroll-area'
      {...props}
    />
  )
}

function ScrollBar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute top-0 right-0 h-full w-2',
        className
      )}
      data-slot='scroll-bar'
      {...props}
    />
  )
}

export { ScrollArea, ScrollBar }
