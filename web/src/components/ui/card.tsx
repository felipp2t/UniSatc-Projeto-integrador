import type { HTMLAttributes } from 'react'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        'rounded-sm border border-border bg-card text-card-foreground shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['flex flex-col space-y-1.5 p-6', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={[
        'font-display font-semibold text-lg leading-none tracking-tight',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={['text-muted-foreground text-sm', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['p-6 pt-0', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['flex items-center p-6 pt-0', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}
