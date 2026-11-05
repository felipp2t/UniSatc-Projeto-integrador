import { MarkdownContent } from '@/components/items/markdown-content'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SecretInput } from '@/components/ui/secret-input'
import { Textarea } from '@/components/ui/textarea'
import {
  isHttpUrl,
  SECRET_MAX,
  TEXT_MAX,
  type TextualItemType,
  URL_MAX,
} from '@/lib/item-validation'

export function ItemContentControl({
  describedBy,
  id,
  invalid,
  readOnly = false,
  onChange,
  type,
  value,
}: {
  describedBy?: string
  id: string
  invalid: boolean
  readOnly?: boolean
  onChange: (value: string) => void
  type: TextualItemType
  value: string
}) {
  if (type === 'text') {
    if (readOnly) {
      return <MarkdownContent content={value} />
    }
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
        readOnly={readOnly}
        required
        rows={7}
        value={value}
      />
    )
  }
  if (type === 'link') {
    if (readOnly && isHttpUrl(value)) {
      return (
        <a
          className='break-all text-primary underline underline-offset-2'
          href={value}
          rel='noopener noreferrer'
          target='_blank'
        >
          {value}
        </a>
      )
    }
    if (readOnly) {
      return <p className='break-all text-sm'>{value}</p>
    }
    return (
      <Input
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoComplete='url'
        className='h-[30px] rounded-none border-border bg-background px-2 focus-visible:border-primary/50 focus-visible:ring-0'
        id={id}
        maxLength={URL_MAX}
        name='content'
        onValueChange={onChange}
        placeholder='https://'
        readOnly={readOnly}
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
      readOnly={readOnly}
      required
      value={value}
    />
  )
}

export function ItemContentField({
  id,
  invalid,
  readOnly = false,
  onChange,
  type,
  value,
}: {
  id: string
  invalid: boolean
  readOnly?: boolean
  onChange: (value: string) => void
  type: TextualItemType
  value: string
}) {
  const errorId = `${id}-error`
  const label =
    type === 'text' ? 'CONTEÚDO' : type === 'link' ? 'URL' : 'VALOR DO SEGREDO'
  const content = (
    <ItemContentControl
      describedBy={invalid ? errorId : undefined}
      id={id}
      invalid={invalid}
      onChange={onChange}
      readOnly={readOnly}
      type={type}
      value={value}
    />
  )
  return (
    <Field aria-invalid={invalid || undefined}>
      {readOnly && type !== 'secret' ? (
        <fieldset className='min-w-0 space-y-2 border-0 p-0'>
          <legend className='font-normal text-[10px] text-muted-foreground'>
            {label}
          </legend>
          {content}
        </fieldset>
      ) : (
        <>
          <FieldLabel
            className='font-normal text-[10px] text-muted-foreground'
            htmlFor={id}
          >
            {label}
          </FieldLabel>
          {content}
        </>
      )}
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
