import { CheckIcon } from '@phosphor-icons/react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={[
        'peer size-4 shrink-0 rounded-sm border border-input bg-background shadow-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <CheckboxPrimitive.Indicator className='flex items-center justify-center'>
        <CheckIcon size={12} weight='bold' />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
