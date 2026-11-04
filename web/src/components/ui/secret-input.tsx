import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { cn } from 'cn'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SecretInputProps extends React.ComponentProps<'input'> {
  containerClassName?: string
  onValueChange?: (value: string) => void
  visibilityLabel?: string
}

export function SecretInput({
  className,
  containerClassName,
  onValueChange,
  visibilityLabel = 'conteúdo',
  ...props
}: SecretInputProps) {
  const [visible, setVisible] = useState(false)
  const handleToggle = useCallback(() => setVisible((current) => !current), [])
  return (
    <div
      className={cn(
        'flex items-center border border-input bg-input/20 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30',
        containerClassName
      )}
    >
      <Input
        {...props}
        className={cn(
          'border-0 bg-transparent shadow-none focus-visible:ring-0 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden',
          className
        )}
        onValueChange={onValueChange}
        type={visible ? 'text' : 'password'}
      />
      <Button
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${visibilityLabel}`}
        className='mr-1'
        onClick={handleToggle}
        size='icon'
        type='button'
        variant='ghost'
      >
        {visible ? (
          <EyeSlashIcon aria-hidden='true' />
        ) : (
          <EyeIcon aria-hidden='true' />
        )}
      </Button>
    </div>
  )
}

export type { SecretInputProps }
