import { cn } from 'cn'
import type {
  HTMLAttributes,
  TableHTMLAttributes,
  ThHTMLAttributes,
} from 'react'

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className='relative w-full overflow-auto'>
      <table
        className={cn('w-full caption-bottom text-xs', className)}
        {...props}
      />
    </div>
  )
}
export function TableHeader(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className='border-border border-b' {...props} />
}
export function TableCaption({
  className,
  ...props
}: HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn('mt-4 text-muted-foreground text-xs', className)}
      {...props}
    />
  )
}
export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className='[&_tr:last-child]:border-0' {...props} />
}
export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-border border-b transition-colors hover:bg-muted/50',
        className
      )}
      {...props}
    />
  )
}
export function TableHead({
  className,
  scope = 'col',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-10 px-3 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wide',
        className
      )}
      scope={scope}
      {...props}
    />
  )
}
export function TableCell({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('p-3 align-middle text-foreground', className)}
      {...props}
    />
  )
}
