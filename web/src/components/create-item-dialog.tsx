import {
  FileTextIcon,
  KeyIcon,
  LinkSimpleIcon,
  ParagraphIcon,
  PlusIcon,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { collectionsApi, itemsApi, workspaceApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import type { CreateItemRequest, CreateItemType } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SecretInput } from '@/components/ui/secret-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { appToast } from '@/components/ui/toast'

const itemTypes = [
  { icon: FileTextIcon, label: 'document', value: 'document' },
  { icon: LinkSimpleIcon, label: 'link', value: 'link' },
  { icon: KeyIcon, label: 'secret', value: 'secret' },
  { icon: ParagraphIcon, label: 'text', value: 'text' },
] as const

interface CollectionLocation {
  id: string
  label: string
}

interface WorkspaceOption {
  id: string
  name: string
}

async function loadCollectionLocations(
  workspaceId: string,
  parentId?: string,
  prefix = ''
): Promise<CollectionLocation[]> {
  const { data: firstPage } = await collectionsApi.list(
    workspaceId,
    parentId,
    0,
    100
  )
  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      collectionsApi.list(workspaceId, parentId, index + 1, 100)
    )
  )
  const collections = [firstPage, ...remainingPages.map(({ data }) => data)]
    .flatMap(({ items }) => items)
    .map((collection) => ({
      id: collection.id,
      label: prefix ? `${prefix} / ${collection.name}` : collection.name,
      name: collection.name,
    }))
  const descendants = await Promise.all(
    collections.map((collection) =>
      loadCollectionLocations(workspaceId, collection.id, collection.label)
    )
  )
  return [
    ...collections.map(({ id, label }) => ({ id, label })),
    ...descendants.flat(),
  ]
}

function buildCreateItemRequest(
  type: CreateItemType,
  title: string,
  content: string,
  location: string
): CreateItemRequest {
  const destination = location === 'root' ? {} : { collectionId: location }
  if (type === 'text') {
    return { title, type, ...destination, textContent: content }
  }
  if (type === 'link') {
    return { title, type, ...destination, linkUrl: content.trim() }
  }
  return { title, type, ...destination, value: content }
}

function ItemTypeButton({
  option,
  selected,
  onSelect,
}: {
  option: (typeof itemTypes)[number]
  selected: boolean
  onSelect: (type: CreateItemType) => void
}) {
  const handleClick = useCallback(() => {
    if (option.value !== 'document') onSelect(option.value)
  }, [onSelect, option.value])
  const Icon = option.icon
  const secretActive = selected && option.value === 'secret'

  return (
    <button
      aria-pressed={selected}
      className={`flex h-8 flex-1 cursor-pointer items-center justify-center gap-1 border border-accent not-first:border-l-0 bg-outline font-mono text-[9px] text-muted-foreground uppercase disabled:cursor-not-allowed disabled:opacity-40 ${selected && !secretActive ? 'border-primary border-x-0 border-t-0 border-b-2 bg-background text-primary' : ''} ${secretActive ? 'border-amber-600 border-x-0 border-y-0 border-b-2 bg-amber-500/20 text-amber-500' : ''}`}
      disabled={option.value === 'document'}
      key={option.value}
      onClick={handleClick}
      title={
        option.value === 'document'
          ? 'Document upload is not supported yet'
          : undefined
      }
      type='button'
    >
      <Icon aria-hidden='true' size={13} />
      {option.label}
    </button>
  )
}

function ItemTypeSelector({
  value,
  onChange,
}: {
  value: CreateItemType
  onChange: (type: CreateItemType) => void
}) {
  return (
    <fieldset className='w-full border-0 p-0'>
      <legend className='mb-1.5 font-mono text-[10px] text-muted-foreground'>
        TYPE
      </legend>
      <div className='flex items-center'>
        {itemTypes.map((option) => (
          <ItemTypeButton
            key={option.value}
            onSelect={onChange}
            option={option}
            selected={value === option.value}
          />
        ))}
      </div>
    </fieldset>
  )
}

function ItemContentControl({
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
  type: CreateItemType
  value: string
}) {
  if (type === 'text') {
    return (
      <Textarea
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className='h-32 resize-none rounded-none border-border bg-outline p-3 focus-visible:border-primary/50 focus-visible:ring-0'
        id={id}
        maxLength={100_000}
        name='content'
        onValueChange={onChange}
        placeholder='Write your text content here...'
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
        maxLength={2048}
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
      maxLength={8192}
      name='content'
      onValueChange={onChange}
      placeholder='Secret value'
      required
      value={value}
    />
  )
}

function ItemContentField({
  id,
  invalid,
  onChange,
  type,
  value,
}: {
  id: string
  invalid: boolean
  onChange: (value: string) => void
  type: CreateItemType
  value: string
}) {
  const errorId = `${id}-error`
  const label =
    type === 'text' ? 'CONTENT' : type === 'link' ? 'URL' : 'SECRET VALUE'
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
            : 'Enter the item content.'}
        </p>
      ) : null}
    </Field>
  )
}

function ItemDestinationFields({
  locations,
  locationsError,
  locationsLoading,
  location,
  onLocationChange,
  onWorkspaceChange,
  titleId,
  workspaceId,
  workspaces,
}: {
  locations: CollectionLocation[]
  locationsError?: string
  locationsLoading: boolean
  location: string
  onLocationChange: (location: string) => void
  onWorkspaceChange: (workspaceId: string) => void
  titleId: string
  workspaceId: string | undefined
  workspaces: WorkspaceOption[]
}) {
  return (
    <>
      {workspaces.length > 1 ? (
        <Field>
          <FieldLabel
            className='font-normal text-[10px] text-muted-foreground'
            htmlFor={`${titleId}-workspace`}
          >
            WORKSPACE
          </FieldLabel>
          <Select onValueChange={onWorkspaceChange} value={workspaceId ?? ''}>
            <SelectTrigger
              className='h-[30px] rounded-none border-border bg-black px-2 text-xs'
              id={`${titleId}-workspace`}
            >
              <SelectValue placeholder='Select a workspace' />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {locations.length > 0 || locationsError ? (
        <Field>
          <FieldLabel
            className='font-normal text-[10px] text-muted-foreground'
            htmlFor={`${titleId}-location`}
          >
            LOCATION
          </FieldLabel>
          <Select
            disabled={locationsLoading}
            onValueChange={onLocationChange}
            value={location}
          >
            <SelectTrigger
              className='h-[30px] rounded-none border-border bg-black px-2 text-xs'
              id={`${titleId}-location`}
            >
              <SelectValue placeholder='Workspace root or folder' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='root'>Workspace root</SelectItem>
              {locations.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {locationsError ? (
            <FieldDescription role='status'>{locationsError}</FieldDescription>
          ) : null}
        </Field>
      ) : null}
    </>
  )
}

async function fetchAvailableWorkspaces(): Promise<WorkspaceOption[]> {
  const { data } = await workspaceApi.list()
  const workspaces = data.filter(
    (workspace): workspace is typeof workspace & { id: string; name: string } =>
      Boolean(workspace.id && workspace.name)
  )
  if (!workspaces.length) {
    throw new Error('Nenhum workspace disponível para esta conta.')
  }
  return workspaces.map(({ id, name }) => ({ id, name }))
}

function getFormErrors(title: string, type: CreateItemType, content: string) {
  return {
    content: !content.trim() || (type === 'link' && !isHttpUrl(content.trim())),
    title: !title.trim(),
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname)
    )
  } catch {
    return false
  }
}

function getCreateError(error: unknown, type: CreateItemType) {
  return getApiErrorMessage(error, {
    fallback:
      type === 'secret'
        ? 'Não foi possível salvar o segredo. Verifique sua permissão e tente novamente.'
        : 'Não foi possível criar o item.',
    network:
      type === 'secret'
        ? 'Não foi possível confirmar o cadastro do segredo. Confira se ele foi criado antes de tentar novamente.'
        : 'Não foi possível confirmar o cadastro. Confira se o item foi criado antes de tentar novamente.',
    statusMessages: {
      409: 'Já existe um item com esse título nessa localização.',
    },
    useServerMessage: type !== 'secret',
  })
}

export function CreateItemDialog({
  collectionId,
  onItemCreated,
  workspaceId: initialWorkspaceId,
  workspaceName,
}: {
  collectionId?: string
  onItemCreated?: () => void
  workspaceId?: string
  workspaceName?: string
}) {
  const titleId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<CreateItemType>('text')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [workspaceId, setWorkspaceId] = useState<string>()
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [location, setLocation] = useState('root')
  const [locations, setLocations] = useState<CollectionLocation[]>([])
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locationsError, setLocationsError] = useState<string>()
  const [submitError, setSubmitError] = useState<string>()
  const [titleInvalid, setTitleInvalid] = useState(false)
  const [contentInvalid, setContentInvalid] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    let ignore = false

    fetchAvailableWorkspaces()
      .then((loadedWorkspaces) => {
        if (ignore) return
        setWorkspaces(loadedWorkspaces)
        const selectedWorkspace = loadedWorkspaces.find(
          ({ id }) => id === initialWorkspaceId
        )
        const [onlyWorkspace] = loadedWorkspaces
        const selected = selectedWorkspace ?? onlyWorkspace
        setWorkspaceId(selected?.id)
        if (selected?.id === initialWorkspaceId && collectionId) {
          setLocation(collectionId)
        } else {
          setLocation('root')
        }
      })
      .catch((error: unknown) => {
        if (!ignore) setSubmitError(toApiError(error).message)
      })
      .finally(() => {
        if (!ignore) setWorkspaceLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [collectionId, initialWorkspaceId, open])

  useEffect(() => {
    if (!(open && workspaceId)) {
      setLocations([])
      return
    }

    let ignore = false
    setLocationsLoading(true)
    setLocationsError(undefined)
    loadCollectionLocations(workspaceId)
      .then((loadedLocations) => {
        if (!ignore) setLocations(loadedLocations)
      })
      .catch(() => {
        if (!ignore) {
          setLocationsError(
            'Folders could not be loaded. Saving to root is still available.'
          )
        }
      })
      .finally(() => {
        if (!ignore) setLocationsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [open, workspaceId])

  const resetForm = useCallback(() => {
    setSelectedType('text')
    setTitle('')
    setContent('')
    setWorkspaceId(undefined)
    setWorkspaces([])
    setLocation('root')
    setLocations([])
    setWorkspaceLoading(false)
    setLocationsLoading(false)
    setLocationsError(undefined)
    setSubmitError(undefined)
    setTitleInvalid(false)
    setContentInvalid(false)
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && submitting) {
        return
      }
      setOpen(nextOpen)
      if (nextOpen) {
        setWorkspaceLoading(true)
        return
      }
      resetForm()
    },
    [resetForm, submitting]
  )

  const handleTitleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(event.target.value)
      setTitleInvalid(false)
    },
    []
  )

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    setContentInvalid(false)
  }, [])

  const handleTypeChange = useCallback((type: CreateItemType) => {
    setSelectedType(type)
    setContent('')
    setContentInvalid(false)
    setSubmitError(undefined)
  }, [])

  const handleWorkspaceChange = useCallback((id: string) => {
    setWorkspaceId(id)
    setLocation('root')
  }, [])

  const handleCancel = useCallback(() => {
    setSubmitError(undefined)
    handleOpenChange(false)
  }, [handleOpenChange])

  const handleSubmit = useCallback(
    async (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSubmitError(undefined)

      const errors = getFormErrors(title, selectedType, content)
      setTitleInvalid(errors.title)
      setContentInvalid(errors.content)

      if (errors.title || errors.content) {
        if (errors.title) {
          formRef.current
            ?.querySelector<HTMLInputElement>('[name="title"]')
            ?.focus()
        } else {
          formRef.current
            ?.querySelector<HTMLElement>('[name="content"]')
            ?.focus()
        }
        return
      }

      if (!workspaceId) {
        setSubmitError('Selecione um workspace para continuar.')
        return
      }

      const request = buildCreateItemRequest(
        selectedType,
        title.trim(),
        content,
        location
      )

      setSubmitting(true)
      try {
        await itemsApi.create(workspaceId, request)
        appToast.success('Item criado.', {
          description: `${request.title} foi salvo com sucesso.`,
        })
        onItemCreated?.()
        handleOpenChange(false)
      } catch (error) {
        setSubmitError(getCreateError(error, selectedType))
      } finally {
        setSubmitting(false)
      }
    },
    [
      content,
      handleOpenChange,
      location,
      onItemCreated,
      selectedType,
      title,
      workspaceId,
    ]
  )

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon aria-hidden='true' size={15} />
          Novo item
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto rounded-none border-border bg-black p-6 text-white shadow-none sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle className='font-bold font-mono text-xs uppercase'>
            <span aria-hidden='true' className='text-primary'>
              {'//'}
            </span>{' '}
            NEW ITEM
          </DialogTitle>
        </DialogHeader>

        <form
          className='mt-6 space-y-6'
          noValidate
          onSubmit={handleSubmit}
          ref={formRef}
        >
          <Field aria-invalid={titleInvalid || undefined}>
            <FieldLabel
              className='font-normal text-[10px] text-muted-foreground'
              htmlFor={`${titleId}-title`}
            >
              TITLE
            </FieldLabel>
            <Input
              aria-describedby={
                titleInvalid ? `${titleId}-title-error` : undefined
              }
              aria-invalid={titleInvalid || undefined}
              autoComplete='off'
              className='h-[30px] rounded-none border-border bg-black px-2 focus-visible:border-primary/50 focus-visible:ring-0'
              id={`${titleId}-title`}
              maxLength={255}
              name='title'
              onChange={handleTitleChange}
              placeholder='item title'
              required
              value={title}
            />
            {titleInvalid ? (
              <p
                className='text-destructive text-xs'
                id={`${titleId}-title-error`}
              >
                Informe um título.
              </p>
            ) : null}
          </Field>

          <ItemTypeSelector onChange={handleTypeChange} value={selectedType} />

          <ItemDestinationFields
            location={location}
            locations={locations}
            locationsError={locationsError}
            locationsLoading={locationsLoading}
            onLocationChange={setLocation}
            onWorkspaceChange={handleWorkspaceChange}
            titleId={titleId}
            workspaceId={workspaceId}
            workspaces={workspaces.map((workspace) => ({
              ...workspace,
              name:
                workspace.id === initialWorkspaceId && workspaceName
                  ? workspaceName
                  : workspace.name,
            }))}
          />

          <ItemContentField
            id={`${titleId}-content`}
            invalid={contentInvalid}
            onChange={handleContentChange}
            type={selectedType}
            value={content}
          />

          {submitError ? (
            <p className='text-destructive text-sm' role='alert'>
              {submitError}
            </p>
          ) : null}

          <DialogFooter className='mt-1 flex-col-reverse border-border border-t pt-4 sm:flex-row sm:justify-end'>
            <Button
              className='h-[30px] rounded-none border border-accent bg-outline px-4 text-[10px] text-muted-foreground hover:text-foreground'
              disabled={submitting}
              onClick={handleCancel}
              variant='outline'
            >
              CANCEL
            </Button>
            <Button
              className='h-[30px] rounded-none px-4 text-[10px]'
              disabled={workspaceLoading || locationsLoading || !workspaceId}
              loading={submitting}
              type='submit'
            >
              <PlusIcon aria-hidden='true' size={13} />
              CREATE
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
