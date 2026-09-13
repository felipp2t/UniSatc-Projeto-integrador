import { cn } from 'cn'
import type * as React from 'react'

interface LabelProps extends React.ComponentProps<'label'> {
  htmlFor: string
}

function Label({ className, children, htmlFor, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'flex select-none items-center gap-2 font-medium text-xs/relaxed leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
        className
      )}
      {...props}
      data-slot='label'
      htmlFor={htmlFor}
    >
      {children}
    </label>
  )
}

export { Label }
