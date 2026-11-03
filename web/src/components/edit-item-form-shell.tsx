import { useCallback, useId } from 'react'
import type { ItemResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { useEditForm } from '@/hooks/use-edit-form'
import { TITLE_MAX } from '@/lib/item-validation'

export const labelClass = 'font-normal text-[10px] text-muted-foreground'
const inputClass =
  'h-[30px] rounded-none border-border bg-black px-2 focus-visible:border-primary/50 focus-visible:ring-0'
const ARCHIVED_NOTICE = 'Restaure o item antes de editar.'
const TYPE_NOTICE =
  'O tipo não pode ser alterado. Para mudar o tipo, crie um novo item.'

export interface FormProps {
  item: ItemResponse
  onBusyChange: (busy: boolean) => void
  onClose: () => void
  readOnly: boolean
  workspaceId: string
}

function TypeField({ id, type }: { id: string; type: string }) {
  return (
    <Field>
      <FieldLabel className={labelClass} htmlFor={id}>
        TIPO
      </FieldLabel>
      <Input
        aria-describedby={`${id}-notice`}
        className={inputClass}
        disabled
        id={id}
        readOnly
        value={type}
      />
      <FieldDescription id={`${id}-notice`}>{TYPE_NOTICE}</FieldDescription>
    </Field>
  )
}

function TitleField({
  id,
  readOnly,
  invalid,
  onChange,
  value,
}: {
  id: string
  readOnly: boolean
  invalid: boolean
  onChange: (value: string) => void
  value: string
}) {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange(event.target.value),
    [onChange]
  )
  return (
    <Field aria-invalid={invalid || undefined}>
      <FieldLabel className={labelClass} htmlFor={id}>
        TÍTULO
      </FieldLabel>
      <Input
        aria-describedby={invalid ? `${id}-error` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete='off'
        className={inputClass}
        id={id}
        maxLength={TITLE_MAX}
        name='title'
        onChange={handleChange}
        readOnly={readOnly}
        required
        value={value}
      />
      {invalid ? (
        <p className='text-destructive text-xs' id={`${id}-error`} role='alert'>
          Informe um título de até {TITLE_MAX} caracteres.
        </p>
      ) : null}
    </Field>
  )
}

function FormFooter({
  archived,
  readOnly,
  busy,
  error,
  onClose,
  saving,
}: {
  archived: boolean
  readOnly: boolean
  busy: boolean
  error: string | undefined
  onClose: () => void
  saving: boolean
}) {
  return (
    <>
      {archived ? (
        <p className='text-muted-foreground text-sm' role='status'>
          {ARCHIVED_NOTICE}
        </p>
      ) : null}
      {error ? (
        <p className='text-destructive text-sm' role='alert'>
          {error}
        </p>
      ) : null}
      <DialogFooter className='mt-1 flex-col-reverse border-border border-t pt-4 sm:flex-row sm:justify-end'>
        <Button
          className='h-[30px] rounded-none px-4 text-[10px]'
          disabled={busy}
          onClick={onClose}
          variant='outline'
        >
          {readOnly ? 'FECHAR' : 'CANCELAR'}
        </Button>
        {readOnly ? null : (
          <Button
            className='h-[30px] rounded-none px-4 text-[10px]'
            disabled={busy}
            loading={saving}
            type='submit'
          >
            SALVAR
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

export function EditFormShell({
  archived,
  children,
  form,
  onClose,
  type,
}: {
  archived: boolean
  children: React.ReactNode
  form: ReturnType<typeof useEditForm>
  onClose: () => void
  type: string
}) {
  const id = useId()
  return (
    <form className='space-y-6' noValidate onSubmit={form.handleSubmit}>
      <fieldset
        className='min-w-0 space-y-6 border-0 p-0'
        disabled={archived || form.busy}
      >
        <TitleField
          id={`${id}-title`}
          invalid={Boolean(form.invalid.title)}
          onChange={form.handleTitle}
          readOnly={form.readOnly}
          value={form.title}
        />
        <TypeField id={`${id}-type`} type={type} />
        {children}
      </fieldset>
      <FormFooter
        archived={archived}
        busy={form.busy}
        error={form.error}
        onClose={onClose}
        readOnly={form.readOnly}
        saving={form.saving}
      />
    </form>
  )
}
