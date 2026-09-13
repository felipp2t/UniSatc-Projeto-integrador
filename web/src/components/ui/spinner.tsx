import { Loading03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from 'cn'

function Spinner({
  className,
  strokeWidth: _strokeWidth,
  ...props
}: Omit<React.ComponentProps<'svg'>, 'strokeWidth'> & {
  strokeWidth?: number
}) {
  return (
    <HugeiconsIcon
      aria-label='Loading'
      className={cn('size-4 animate-spin', className)}
      data-slot='spinner'
      icon={Loading03Icon}
      role='status'
      strokeWidth={2}
      {...props}
    />
  )
}

export { Spinner }
