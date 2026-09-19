import type { InputHTMLAttributes } from 'react'
import { cn } from 'cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type = 'text', ...props }: InputProps) {
  const classes = cn(
    'flex h-9 w-full min-w-0 rounded-sm border border-input bg-background px-3 py-1 font-mono text-foreground text-xs shadow-xs transition-colors',
    'placeholder:text-muted-foreground',
    'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'file:border-0 file:bg-transparent file:font-medium file:font-mono file:text-xs',
    className
  )

  return <input className={classes} type={type} {...props} />
}
