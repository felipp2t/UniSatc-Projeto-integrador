import { CaretRightIcon, CheckIcon } from '@phosphor-icons/react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuSub = DropdownMenuPrimitive.Sub

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={[
          'z-50 min-w-32 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=open]:animate-in',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={[
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-2 font-mono text-xs uppercase outline-none transition-colors focus:bg-primary/10 focus:text-primary data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

export function DropdownMenuCheckboxItem({
  children,
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={[
        'relative flex cursor-pointer select-none items-center gap-2 py-2 pr-2.5 pl-7 font-mono text-xs uppercase outline-none focus:bg-primary/10 focus:text-primary data-[state=checked]:text-primary',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <span className='absolute left-2 flex size-3.5 items-center justify-center'>
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon size={14} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={[
        'px-2 py-1.5 font-bold font-mono text-[10px] text-muted-foreground uppercase tracking-wide',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={['-mx-1 my-1 h-px bg-border', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

export function DropdownMenuSubTrigger({
  children,
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={[
        'flex cursor-pointer select-none items-center gap-2 px-2.5 py-2 font-mono text-xs uppercase outline-none focus:bg-primary/10 focus:text-primary',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
      <CaretRightIcon className='ml-auto' size={14} />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

export function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      className={[
        'z-50 min-w-32 overflow-hidden border border-border bg-card p-1 text-foreground shadow-lg',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}
