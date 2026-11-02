import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { itemsApi } from '@/api/endpoints'
import { itemKeys } from '@/api/item-keys'
import type { ItemResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { attachmentFilename } from '@/lib/attachment-filename'

const OBJECT_URL_REVOKE_DELAY_MS = 30_000
const ATTACHMENT_CACHE_MS = 30_000
const actionClass = 'h-[30px] rounded-none px-4 text-[10px]'

interface LoadedAttachment {
  blob: Blob
  contentDisposition?: string
}

const attachmentQuery = (workspaceId: string, itemId: string) => ({
  gcTime: ATTACHMENT_CACHE_MS,
  queryFn: async (): Promise<LoadedAttachment> => {
    const response = await itemsApi.downloadAttachment(workspaceId, itemId)
    const contentDisposition = response.headers['content-disposition']
    return {
      blob: response.data,
      contentDisposition:
        typeof contentDisposition === 'string' ? contentDisposition : undefined,
    }
  },
  queryKey: itemKeys.attachment(workspaceId, itemId),
  refetchOnWindowFocus: false,
  retry: false,
  staleTime: ATTACHMENT_CACHE_MS,
})

function isPreviewable(blob: Blob) {
  return blob.type === 'application/pdf' || blob.type.startsWith('image/')
}

function AttachmentPreview({
  blob,
  isDocument,
  previewUrl,
  title,
}: {
  blob: Blob
  isDocument: boolean
  previewUrl?: string
  title: string
}) {
  const { type } = blob
  if (type === 'application/pdf') {
    return (
      <div className='border border-border bg-outline p-2'>
        <iframe
          className='h-[45svh] w-full bg-white'
          src={previewUrl}
          title={`Visualização de ${title}`}
        />
      </div>
    )
  }
  if (type.startsWith('image/')) {
    return (
      <div className='border border-border bg-outline p-2'>
        <img
          alt={title}
          className='mx-auto max-h-[45svh] max-w-full object-contain'
          src={previewUrl}
        />
      </div>
    )
  }
  if (!isDocument) return null
  return (
    <p className='text-muted-foreground text-sm'>
      Este tipo de arquivo não pode ser visualizado aqui. Baixe o arquivo para
      abri-lo.
    </p>
  )
}

function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!(blob && isPreviewable(blob))) {
      setUrl(undefined)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])
  return url
}

export function ItemAttachmentDialog({
  item,
  workspaceId,
}: {
  item: ItemResponse
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [previewRequested, setPreviewRequested] = useState(false)
  const [downloadError, setDownloadError] = useState(false)
  const isImage = item.type === 'image'
  const triggerLabel = isImage ? 'Abrir imagem' : 'Abrir documento'
  const options = attachmentQuery(workspaceId, item.id)
  const query = useQuery({
    ...options,
    enabled: open && (isImage || previewRequested),
  })
  const attachment = query.isEnabled ? query.data : undefined
  const previewUrl = useObjectUrl(attachment?.blob)
  const loading = query.isFetching && !attachment
  const previewFailed = open && query.isError && !attachment

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    setPreviewRequested(false)
    setDownloadError(false)
  }, [])

  const { refetch } = query
  const preview = useCallback(() => {
    setPreviewRequested(true)
    setDownloadError(false)
    if (previewFailed) refetch()
  }, [previewFailed, refetch])

  const download = useCallback(async () => {
    try {
      const loaded = await queryClient.fetchQuery(
        attachmentQuery(workspaceId, item.id)
      )
      setDownloadError(false)
      const url = URL.createObjectURL(loaded.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = attachmentFilename(
        loaded.contentDisposition,
        item.title
      )
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS)
    } catch {
      setDownloadError(true)
    }
  }, [item.id, item.title, queryClient, workspaceId])

  let error: string | undefined
  if (downloadError) error = 'Não foi possível baixar o anexo.'
  else if (previewFailed) {
    error = isImage
      ? 'Não foi possível carregar a imagem. Tente novamente.'
      : 'Não foi possível carregar o anexo para visualização. Tente novamente.'
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label={`${triggerLabel} ${item.title}`}
          size='sm'
          variant='outline'
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto rounded-none border-border bg-black p-6 text-white shadow-none sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle className='break-words font-bold font-mono text-xs uppercase'>
            {item.title}
          </DialogTitle>
          <DialogDescription className='sr-only'>
            Visualize ou baixe o anexo.
          </DialogDescription>
        </DialogHeader>
        <section className='mt-6 space-y-3'>
          <div className='flex flex-wrap gap-2'>
            {!isImage && (!previewRequested || previewFailed) ? (
              <Button
                className={actionClass}
                disabled={loading}
                onClick={preview}
                variant='outline'
              >
                {loading
                  ? 'Carregando anexo…'
                  : 'Visualizar ou tentar novamente (PDF/imagem)'}
              </Button>
            ) : null}
            {isImage && previewFailed ? (
              <Button
                className={actionClass}
                disabled={loading}
                onClick={preview}
                variant='outline'
              >
                Tentar carregar imagem novamente
              </Button>
            ) : null}
            <Button
              className={actionClass}
              disabled={loading}
              onClick={download}
              variant='outline'
            >
              Baixar arquivo
            </Button>
          </div>
          {loading ? (
            <p
              aria-live='polite'
              className='text-muted-foreground text-sm'
              role='status'
            >
              Carregando anexo…
            </p>
          ) : null}
          {error ? (
            <p className='text-destructive text-sm' role='alert'>
              {error}
            </p>
          ) : null}
          {attachment ? (
            <AttachmentPreview
              blob={attachment.blob}
              isDocument={!isImage}
              previewUrl={previewUrl}
              title={item.title}
            />
          ) : null}
        </section>
      </DialogContent>
    </Dialog>
  )
}
