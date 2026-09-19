import type { InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type = 'text', ...props }: InputProps) {
  const classes = [
    'flex h-9 w-full min-w-0 rounded-sm border border-input bg-background px-3 py-1 font-mono text-xs text-foreground shadow-xs transition-colors',
    'placeholder:text-muted-foreground',
    'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'file:border-0 file:bg-transparent file:font-mono file:text-xs file:font-medium',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <input className={classes} type={type} {...props} />
}
