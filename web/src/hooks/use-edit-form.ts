import { useCallback, useEffect, useState } from 'react'
import { appToast } from '@/components/ui/toast'
import { isTitleInvalid } from '@/lib/item-validation'

export function useEditForm({
  archived,
  readOnly = false,
  extraBusy = false,
  getError,
  initialTitle,
  onBusyChange,
  onClose,
  pending,
  save,
  validate,
}: {
  archived: boolean
  readOnly?: boolean
  extraBusy?: boolean
  getError: (cause: unknown) => string
  initialTitle: string
  onBusyChange: (busy: boolean) => void
  onClose: () => void
  pending: boolean
  save: (title: string) => Promise<unknown>
  validate: () => Record<string, boolean>
}) {
  const [title, setTitle] = useState(initialTitle)
  const [invalid, setInvalid] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string>()
  const busy = pending || extraBusy

  useEffect(() => onBusyChange(busy), [busy, onBusyChange])

  const clearInvalid = useCallback(
    (field: string) =>
      setInvalid((current) => ({ ...current, [field]: false })),
    []
  )
  const handleTitle = useCallback(
    (value: string) => {
      setTitle(value)
      clearInvalid('title')
    },
    [clearInvalid]
  )
  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (archived || readOnly || busy) return
    setError(undefined)
    const next = { ...validate(), title: isTitleInvalid(title) }
    setInvalid(next)
    if (Object.values(next).some(Boolean)) return
    try {
      await save(title.trim())
      appToast.success('Item atualizado.')
      onClose()
    } catch (cause) {
      setError(getError(cause))
    }
  }

  return {
    busy,
    clearInvalid,
    error,
    handleSubmit,
    handleTitle,
    invalid,
    saving: pending,
    title,
  }
}
