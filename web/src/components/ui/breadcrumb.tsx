import { CaretRightIcon, DotsThreeIcon } from '@phosphor-icons/react'
import { cn } from 'cn'
import { Slot } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

export function Breadcrumb({ ...props }: ComponentProps<'nav'>) {
  return <nav aria-label='breadcrumb' {...props} />
}

export function BreadcrumbList({ className, ...props }: ComponentProps<'ol'>) {
  return (
    <ol
      className={cn(
        'flex flex-wrap items-center gap-1.5 break-words font-mono text-muted-foreground text-xs sm:gap-2.5',
        className
      )}
      {...props}
    />
  )
}

export function BreadcrumbItem({ className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      className={cn('inline-flex items-center gap-1.5', className)}
      {...props}
    />
  )
}

export function BreadcrumbLink({
  asChild,
  className,
  ...props
}: ComponentProps<'a'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'a'

  return (
    <Comp
      className={cn('transition-colors hover:text-foreground', className)}
      {...props}
    />
  )
}

export function BreadcrumbPage({
  className,
  ...props
}: ComponentProps<'span'>) {
  return (
    <span
      aria-current='page'
      className={cn('font-normal text-foreground', className)}
      {...props}
    />
  )
}

export function BreadcrumbSeparator({
  children,
  className,
  ...props
}: ComponentProps<'li'> & { children?: ReactNode }) {
  return (
    <li
      aria-hidden='true'
      className={cn('[&>svg]:size-3.5', className)}
      role='presentation'
      {...props}
    >
      {children ?? <CaretRightIcon />}
    </li>
  )
}

export function BreadcrumbEllipsis({
  className,
  ...props
}: ComponentProps<'span'>) {
  return (
    <span
      aria-hidden='true'
      className={cn('flex size-9 items-center justify-center', className)}
      {...props}
    >
      <DotsThreeIcon className='size-4' />
      <span className='sr-only'>Mais</span>
    </span>
  )
}

export function BreadcrumbEllipsisTrigger({
  className,
  ...props
}: ComponentProps<'button'>) {
  return (
    <button
      aria-label='Mostrar níveis ocultos'
      className={cn(
        'flex size-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
      type='button'
      {...props}
    >
      <DotsThreeIcon aria-hidden='true' className='size-4' />
    </button>
  )
}
