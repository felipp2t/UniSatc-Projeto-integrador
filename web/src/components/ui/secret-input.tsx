import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { cn } from 'cn'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SecretInputProps extends React.ComponentProps<'input'> {
  onValueChange?: (value: string) => void
}

export function SecretInput({
  className,
  onValueChange,
  ...props
}: SecretInputProps) {
  const [visible, setVisible] = useState(false)
  const handleToggle = useCallback(() => setVisible((current) => !current), [])
  return (
    <div className='flex items-center border border-input bg-input/20 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30'>
      <Input
        {...props}
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
        onClick={handleToggle}
        size='icon'
        type='button'
        variant='ghost'
      >
        {visible ? (
          <EyeSlashIcon aria-hidden='true' size={16} />
        ) : (
          <EyeIcon aria-hidden='true' size={16} />
        )}
      </Button>
    </div>
  )
}

export type { SecretInputProps }
