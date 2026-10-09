import { cn } from 'cn'
import type { TextareaHTMLAttributes } from 'react'
import { useCallback } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  onValueChange?: (value: string) => void
}

export function Textarea({
  className,
  onValueChange,
  ...props
}: TextareaProps) {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onValueChange?.(event.target.value)
      props.onChange?.(event)
    },
    [onValueChange, props.onChange]
  )
  return (
    <textarea
      className={cn(
        'flex min-h-20 w-full rounded-sm border border-input bg-background px-3 py-2 font-mono text-foreground text-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
      onChange={handleChange}
    />
  )
}
