import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SecretInput } from '@/components/ui/secret-input'
import { Textarea } from '@/components/ui/textarea'
import {
  SECRET_MAX,
  TEXT_MAX,
  type TextualItemType,
  URL_MAX,
} from '@/lib/item-validation'

export function ItemContentControl({
  describedBy,
  id,
  invalid,
  onChange,
  type,
  value,
}: {
  describedBy?: string
  id: string
  invalid: boolean
  onChange: (value: string) => void
  type: TextualItemType
  value: string
}) {
  if (type === 'text') {
    return (
      <Textarea
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className='h-32 resize-none rounded-none border-border bg-outline p-3 focus-visible:border-primary/50 focus-visible:ring-0'
        id={id}
        maxLength={TEXT_MAX}
        name='content'
        onValueChange={onChange}
        placeholder='Escreva o conteúdo do texto aqui...'
        required
        rows={7}
        value={value}
      />
    )
  }
  if (type === 'link') {
    return (
      <Input
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoComplete='url'
        className='h-[30px] rounded-none border-border bg-black px-2 focus-visible:border-primary/50 focus-visible:ring-0'
        id={id}
        maxLength={URL_MAX}
        name='content'
        onValueChange={onChange}
        placeholder='https://'
        required
        type='url'
        value={value}
      />
    )
  }
  return (
    <SecretInput
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      autoComplete='off'
      id={id}
      maxLength={SECRET_MAX}
      name='content'
      onValueChange={onChange}
      placeholder='Valor do segredo'
      required
      value={value}
    />
  )
}

export function ItemContentField({
  id,
  invalid,
  onChange,
  type,
  value,
}: {
  id: string
  invalid: boolean
  onChange: (value: string) => void
  type: TextualItemType
  value: string
}) {
  const errorId = `${id}-error`
  const label =
    type === 'text' ? 'CONTEÚDO' : type === 'link' ? 'URL' : 'VALOR DO SEGREDO'
  return (
    <Field aria-invalid={invalid || undefined}>
      <FieldLabel
        className='font-normal text-[10px] text-muted-foreground'
        htmlFor={id}
      >
        {label}
      </FieldLabel>
      <ItemContentControl
        describedBy={invalid ? errorId : undefined}
        id={id}
        invalid={invalid}
        onChange={onChange}
        type={type}
        value={value}
      />
      {invalid ? (
        <p className='text-destructive text-xs' id={errorId} role='alert'>
          {type === 'link'
            ? 'Informe uma URL completa iniciada por http:// ou https://.'
            : 'Informe o conteúdo do item.'}
        </p>
      ) : null}
    </Field>
  )
}
