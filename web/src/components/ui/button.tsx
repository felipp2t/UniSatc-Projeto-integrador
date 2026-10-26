import { CircleNotchIcon } from '@phosphor-icons/react'
import { cn } from 'cn'
import type { ButtonHTMLAttributes } from 'react'

const buttonVariants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive/60',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
  outline:
    'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
} as const

const buttonSizes = {
  default: 'h-9 px-4 py-2',
  icon: 'size-9',
  lg: 'h-10 rounded-md px-6',
  sm: 'h-8 rounded-md px-3 text-xs',
} as const

export type ButtonVariant = keyof typeof buttonVariants
export type ButtonSize = keyof typeof buttonSizes

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  size?: ButtonSize
  variant?: ButtonVariant
}

export function Button({
  children,
  className,
  disabled,
  loading = false,
  type = 'button',
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps) {
  const classes = cn(
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium font-mono text-xs uppercase tracking-wide transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    buttonVariants[variant],
    buttonSizes[size],
    className
  )

  return (
    <button
      aria-busy={loading || undefined}
      className={classes}
      disabled={loading || disabled}
      type={type}
      {...props}
    >
      {!!loading && (
        <CircleNotchIcon
          aria-hidden='true'
          className='animate-spin'
          size={14}
        />
      )}
      {children}
    </button>
  )
}
