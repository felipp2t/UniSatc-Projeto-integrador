import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from 'cn'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SecretInputProps extends React.ComponentProps<'input'> {
  onValueChange?: (value: string) => void
}

export function SecretInput({ className, ...props }: SecretInputProps) {
  const [visible, setVisible] = useState(false)
  const { onValueChange, ...inputProps } = props
  const toggleVisibility = useCallback(
    () => setVisible((current) => !current),
    []
  )
  return (
    <div className='flex items-center border border-input bg-input/20 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30'>
      <Input
        {...inputProps}
        className={cn(
          'border-0 bg-transparent shadow-none focus-visible:ring-0',
          className
        )}
        onValueChange={onValueChange}
        type={visible ? 'text' : 'password'}
      />
      <Button
        aria-label={visible ? 'Ocultar conteúdo' : 'Mostrar conteúdo'}
        className='mr-1'
        onClick={toggleVisibility}
        size='icon-sm'
        type='button'
        variant='ghost'
      >
        <HugeiconsIcon icon={visible ? ViewOffIcon : ViewIcon} />
      </Button>
    </div>
  )
}

export type { SecretInputProps }
