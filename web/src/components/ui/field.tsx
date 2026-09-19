import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react'
import { cn } from 'cn'

interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
}

export function Field({
  className,
  orientation = 'vertical',
  ...props
}: FieldProps) {
  return (
    <div
      className={cn(
        'group/field flex w-full gap-1.5',
        orientation === 'horizontal'
          ? 'flex-row items-center'
          : 'flex-col *:w-full',
        className
      )}
      {...props}
    />
  )
}

export function FieldLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: The control association is supplied through htmlFor.
    <label
      className={cn(
        'flex w-fit items-center gap-2 font-medium font-mono text-xs leading-snug',
        className
      )}
      {...props}
    />
  )
}

export function FieldContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-1 flex-col gap-1', className)} {...props} />
  )
}

export function FieldDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-muted-foreground text-xs', className)} {...props} />
  )
}

export function FieldError({
  children,
  className,
  errors,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  errors?: Array<{ message?: string } | undefined>
  children?: ReactNode
}) {
  const messages = errors
    ?.map((error) => error?.message)
    .filter((message): message is string => Boolean(message))

  if (!(children || messages?.length)) {
    return null
  }

  return (
    <div
      className={cn('text-destructive text-xs', className)}
      role='alert'
      {...props}
    >
      {children ?? messages?.join(', ')}
    </div>
  )
}
