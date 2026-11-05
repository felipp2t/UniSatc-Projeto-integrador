import { FileText, KeyRound, Link, Text, Plus } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { collectionsApi, itemsApi, workspaceApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import type { CreateItemRequest, CreateItemType } from '@/api/types'
import { ItemContentField } from '@/components/items/item-content-control'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { appToast } from '@/components/ui/toast'
import { useAttachmentUpload } from '@/hooks/use-attachment-upload'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'
import { canCreateItem } from '@/lib/item-permissions'
import {
  ATTACHMENT_REQUIRED_MESSAGE,
  isContentInvalid,
  isTitleInvalid,
  type TextualItemType,
  TITLE_MAX,
  validateAttachmentFile,
} from '@/lib/item-validation'
import { AttachmentFields } from '@/components/items/attachment-fields'
import { UploadProgress } from '@/components/items/upload-progress'

const itemTypes = [
  { icon: FileText, label: 'documento', value: 'file' },
  { icon: Link, label: 'link', value: 'link' },
  { icon: KeyRound, label: 'segredo', value: 'secret' },
  { icon: Text, label: 'texto', value: 'text' },
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
  type: TextualItemType,
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
  disabled,
  option,
  selected,
  onSelect,
}: {
  disabled: boolean
  option: (typeof itemTypes)[number]
  selected: boolean
  onSelect: (type: CreateItemType) => void
}) {
  const handleClick = useCallback(() => {
    onSelect(option.value)
  }, [onSelect, option.value])
  const Icon = option.icon
  const secretActive = selected && option.value === 'secret'

  return (
    <button
      aria-pressed={selected}
      className={`flex h-8 flex-1 cursor-pointer items-center justify-center gap-1 border border-accent not-first:border-l-0 bg-outline font-mono text-[9px] text-muted-foreground uppercase disabled:cursor-not-allowed disabled:opacity-40 ${selected && !secretActive ? 'border-primary border-x-0 border-t-0 border-b-2 bg-background text-primary' : ''} ${secretActive ? 'border-amber-600 border-x-0 border-y-0 border-b-2 bg-amber-500/20 text-amber-500' : ''}`}
      disabled={disabled}
      key={option.value}
      onClick={handleClick}
      type='button'
    >
      <Icon aria-hidden='true' size={13} />
      {option.label}
    </button>
  )
}

function ItemTypeSelector({
  disabled,
  options,
  value,
  onChange,
}: {
  disabled: boolean
  options: readonly (typeof itemTypes)[number][]
  value: CreateItemType
  onChange: (type: CreateItemType) => void
}) {
  return (
    <fieldset className='w-full border-0 p-0'>
      <legend className='mb-1.5 font-mono text-[10px] text-muted-foreground'>
        TIPO
      </legend>
      <div className='flex items-center'>
        {options.map((option) => (
          <ItemTypeButton
            disabled={disabled}
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
              className='h-[30px] rounded-none border-border bg-background px-2 text-xs'
              id={`${titleId}-workspace`}
            >
              <SelectValue placeholder='Selecione um workspace' />
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
            LOCAL
          </FieldLabel>
          <Select
            disabled={locationsLoading}
            onValueChange={onLocationChange}
            value={location}
          >
            <SelectTrigger
              className='h-[30px] rounded-none border-border bg-background px-2 text-xs'
              id={`${titleId}-location`}
            >
              <SelectValue placeholder='Raiz do workspace ou pasta' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='root'>Raiz do workspace</SelectItem>
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
    content: type !== 'file' && isContentInvalid(type, content),
    title: isTitleInvalid(title),
  }
}

function getFileError(type: CreateItemType, file: File | undefined) {
  if (type !== 'file') return
  return file ? validateAttachmentFile(file) : ATTACHMENT_REQUIRED_MESSAGE
}

function getFirstInvalidField(
  errors: ReturnType<typeof getFormErrors>,
  fileError: string | undefined
): 'title' | 'content' | 'file' | undefined {
  if (errors.title) return 'title'
  if (errors.content) return 'content'
  if (fileError) return 'file'
  return undefined
}

const secretStatusMessages: Record<number, string> = {
  403: 'Você não tem permissão para criar segredos neste workspace.',
  503: 'O armazenamento de segredos não está configurado no servidor. Avise o administrador.',
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
      ...(type === 'secret' ? secretStatusMessages : {}),
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
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File>()
  const { cancel, progress, upload } = useAttachmentUpload()
  const [workspaceId, setWorkspaceId] = useState<string>()
  const permissions = useWorkspacePermissions(open ? workspaceId : undefined)
  const allowedTypes = itemTypes.filter((option) =>
    canCreateItem(permissions, option.value)
  )
  const canCreateSelectedType = canCreateItem(permissions, selectedType)
  const canReadCollections = permissions.can('collection', 'read')
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [location, setLocation] = useState('root')
  const [locations, setLocations] = useState<CollectionLocation[]>([])
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locationsError, setLocationsError] = useState<string>()
  const [submitError, setSubmitError] = useState<string>()
  const [titleInvalid, setTitleInvalid] = useState(false)
  const [contentInvalid, setContentInvalid] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string>()
  const [submittingType, setSubmittingType] = useState<CreateItemType>()
  const submitting = submittingType !== undefined
  const isUploading = submittingType === 'file'

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
    if (!(open && workspaceId && canReadCollections)) {
      setLocationsLoading(false)
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
            'Não foi possível carregar as pastas. Ainda é possível salvar na raiz.'
          )
        }
      })
      .finally(() => {
        if (!ignore) setLocationsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [canReadCollections, open, workspaceId])

  const resetForm = useCallback(() => {
    setSelectedType('text')
    setTitle('')
    setContent('')
    setDescription('')
    setFile(undefined)
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
    setAttachmentError(undefined)
  }, [])

  const closeDialog = useCallback(() => {
    setOpen(false)
    resetForm()
  }, [resetForm])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && submitting) {
        return
      }
      if (nextOpen) {
        setOpen(true)
        setWorkspaceLoading(true)
        return
      }
      closeDialog()
    },
    [closeDialog, submitting]
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
    setAttachmentError(undefined)
    setSubmitError(undefined)
    setFile(undefined)
  }, [])

  const handleWorkspaceChange = useCallback((id: string) => {
    setWorkspaceId(id)
    setLocation('root')
  }, [])

  const handleCancel = useCallback(() => {
    if (isUploading) {
      cancel()
      setSubmitError(
        'Envio cancelado. Confira se o item foi criado antes de tentar novamente.'
      )
      return
    }
    setSubmitError(undefined)
    handleOpenChange(false)
  }, [cancel, handleOpenChange, isUploading])

  const handleFileChange = useCallback((selectedFile: File | undefined) => {
    setFile(selectedFile)
    setAttachmentError(undefined)
  }, [])

  const submitAttachment = useCallback(
    async (targetWorkspaceId: string, selectedFile: File) => {
      setSubmittingType('file')
      try {
        await upload((options) =>
          itemsApi.createAttachment(
            targetWorkspaceId,
            {
              collectionId: location === 'root' ? undefined : location,
              description: description.trim() || undefined,
              file: selectedFile,
              title: title.trim(),
            },
            options
          )
        )
        appToast.success('Documento criado.', {
          description: `${title.trim()} foi salvo com sucesso.`,
        })
        onItemCreated?.()
        closeDialog()
      } catch (error) {
        if (!toApiError(error).isCanceled) {
          setSubmitError(getCreateError(error, 'file'))
        }
      } finally {
        setSubmittingType(undefined)
      }
    },
    [closeDialog, description, location, onItemCreated, title, upload]
  )

  const submitItem = useCallback(
    async (targetWorkspaceId: string, type: TextualItemType) => {
      const request = buildCreateItemRequest(
        type,
        title.trim(),
        content,
        location
      )
      setSubmittingType(type)
      try {
        await itemsApi.create(targetWorkspaceId, request)
        appToast.success('Item criado.', {
          description: `${request.title} foi salvo com sucesso.`,
        })
        onItemCreated?.()
        closeDialog()
      } catch (error) {
        setSubmitError(getCreateError(error, type))
      } finally {
        setSubmittingType(undefined)
      }
    },
    [closeDialog, content, location, onItemCreated, title]
  )

  const handleSubmit = useCallback(
    async (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSubmitError(undefined)

      const errors = getFormErrors(title, selectedType, content)
      const fileError = getFileError(selectedType, file)
      setTitleInvalid(errors.title)
      setContentInvalid(errors.content)
      setAttachmentError(fileError)

      const firstInvalid = getFirstInvalidField(errors, fileError)
      if (firstInvalid) {
        formRef.current
          ?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
          ?.focus()
        return
      }

      if (!workspaceId) {
        setSubmitError('Selecione um workspace para continuar.')
        return
      }

      if (!canCreateSelectedType) {
        setSubmitError('Você não tem permissão para criar este tipo de item.')
        return
      }

      if (selectedType !== 'file') {
        await submitItem(workspaceId, selectedType)
        return
      }
      if (file) await submitAttachment(workspaceId, file)
    },
    [
      canCreateSelectedType,
      content,
      file,
      selectedType,
      submitAttachment,
      submitItem,
      title,
      workspaceId,
    ]
  )

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden='true' size={15} />
          Novo item
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto rounded-none border-border bg-card p-7 text-foreground shadow-none sm:max-w-[30rem]'>
        <DialogHeader>
          <DialogTitle className='font-bold font-mono text-xs uppercase'>
            <span aria-hidden='true' className='text-primary'>
              {'//'}
            </span>{' '}
            NOVO ITEM
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
              TÍTULO
            </FieldLabel>
            <Input
              aria-describedby={
                titleInvalid ? `${titleId}-title-error` : undefined
              }
              aria-invalid={titleInvalid || undefined}
              autoComplete='off'
              className='h-[30px] rounded-none border-border bg-background px-2 focus-visible:border-primary/50 focus-visible:ring-0'
              id={`${titleId}-title`}
              maxLength={TITLE_MAX}
              name='title'
              onChange={handleTitleChange}
              placeholder='título do item'
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

          {permissions.isError ? (
            <p className='text-destructive text-xs' role='alert'>
              Não foi possível verificar suas permissões. Feche e abra o diálogo
              para tentar novamente.
            </p>
          ) : null}
          <ItemTypeSelector
            disabled={submitting}
            onChange={handleTypeChange}
            options={allowedTypes}
            value={selectedType}
          />

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

          {canCreateSelectedType ? (
            selectedType === 'file' ? (
              <AttachmentFields
                description={description}
                disabled={isUploading}
                error={attachmentError}
                file={file}
                id={titleId}
                onDescriptionChange={setDescription}
                onFileChange={handleFileChange}
              />
            ) : (
              <ItemContentField
                id={`${titleId}-content`}
                invalid={contentInvalid}
                onChange={handleContentChange}
                type={selectedType}
                value={content}
              />
            )
          ) : (
            <p className='text-muted-foreground text-xs' role='status'>
              {permissions.isPending
                ? 'Verificando permissões…'
                : 'O tipo selecionado não está disponível para seu papel. Selecione um tipo permitido.'}
            </p>
          )}
          {isUploading ? (
            <UploadProgress progress={progress ?? 0}>
              <p>
                O cancelamento é garantido antes da confirmação. Se o envio ou
                resposta for interrompido, confira se o documento foi criado
                antes de tentar novamente.
              </p>
            </UploadProgress>
          ) : null}

          {submitError ? (
            <p className='text-destructive text-sm' role='alert'>
              {submitError}
            </p>
          ) : null}

          <DialogFooter className='mt-1 flex-col-reverse border-border border-t pt-4 sm:flex-row sm:justify-end'>
            <Button
              className='h-[30px] rounded-none border border-accent bg-outline px-4 text-[10px] text-muted-foreground hover:text-foreground'
              disabled={submitting && !isUploading}
              onClick={handleCancel}
              variant='outline'
            >
              {isUploading ? 'CANCELAR ENVIO' : 'CANCELAR'}
            </Button>
            <Button
              className='h-[30px] rounded-none px-4 text-[10px]'
              disabled={
                workspaceLoading ||
                locationsLoading ||
                !workspaceId ||
                !canCreateSelectedType
              }
              loading={submitting}
              type='submit'
            >
              <Plus aria-hidden='true' size={13} />
              CRIAR
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
