import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collectionsApi,
  publicationApi,
  workspaceTeamsApi,
} from '@/api/endpoints'
import type { PublicationType } from '@/api/types'
import { publicationKeys, receivedContentKeys } from '@/api/workspace-keys'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { appToast } from '@/components/ui/toast'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'

export interface ShareTarget {
  collectionId?: string
  id: string
  kind: 'collection' | 'item'
  name: string
}

export function ShareAccessDialog({
  onClose,
  open,
  target,
  workspaceId,
}: {
  onClose: () => void
  open: boolean
  target: ShareTarget
  workspaceId: string
}) {
  const permissions = useWorkspacePermissions(open ? workspaceId : undefined)
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onClose()
    },
    [onClose]
  )

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Publicar {target.kind === 'collection' ? 'pasta' : 'item'}
          </DialogTitle>
          <DialogDescription>{target.name}</DialogDescription>
        </DialogHeader>
        {permissions.isPending ? (
          <LoadingState label='Verificando permissão…' />
        ) : permissions.error ? (
          <ErrorState error={permissions.error} />
        ) : (
          <PublicationSettings
            canPublish={permissions.isLeader}
            canRevokeOrphan={permissions.isOwner || permissions.isAdmin}
            target={target}
            workspaceId={workspaceId}
          />
        )}
        <DialogFooter>
          <Button onClick={onClose} variant='outline'>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PublicationSettings({
  canPublish,
  canRevokeOrphan,
  target,
  workspaceId,
}: {
  canPublish: boolean
  canRevokeOrphan: boolean
  target: ShareTarget
  workspaceId: string
}) {
  const client = useQueryClient()
  const activePublicationsRef = useRef<HTMLElement>(null)
  const [teamId, setTeamId] = useState('')
  const collectionId =
    target.collectionId ??
    (target.kind === 'collection' ? target.id : undefined)
  const path = useQuery({
    enabled: Boolean(collectionId),
    queryFn: async () => {
      if (!collectionId) throw new Error('Coleção indisponível.')
      return (await collectionsApi.path(workspaceId, collectionId)).data
    },
    queryKey: ['publication-source-path', workspaceId, collectionId],
  })
  const sourceCollectionId = path.data?.[0]?.id
  const key = publicationKeys.configuration(workspaceId, sourceCollectionId)
  const configuration = useQuery({
    enabled: Boolean(sourceCollectionId),
    queryFn: async () =>
      (
        await publicationApi.configuration(
          workspaceId,
          sourceCollectionId as string
        )
      ).data,
    queryKey: key,
  })
  const teams = useQuery({
    enabled: canRevokeOrphan,
    queryFn: async () => (await workspaceTeamsApi.list(workspaceId)).data,
    queryKey: ['workspace-teams', workspaceId],
  })
  const update = useMutation({
    mutationFn: async ({
      action,
      publicationId,
    }: {
      action: 'publish' | 'revoke'
      publicationId?: string
    }) => {
      if (action === 'publish') {
        if (!teamId) throw new Error('Selecione um time.')
        await publicationApi.publish(workspaceId, {
          destinationTeamId: teamId,
          originalId: target.id,
          originalType: (target.kind === 'collection'
            ? 'COLLECTION'
            : 'ITEM') as PublicationType,
        })
        return
      }
      if (!publicationId) throw new Error('Publicação indisponível.')
      await publicationApi.revoke(workspaceId, publicationId)
    },
    onError: () => appToast.error('Não foi possível atualizar a publicação.'),
    onSuccess: async (_result, variables) => {
      if (variables.action === 'revoke') activePublicationsRef.current?.focus()
      appToast.success(
        variables.action === 'publish'
          ? 'Conteúdo publicado.'
          : 'Publicação revogada.'
      )
      await Promise.all([
        client.invalidateQueries({
          queryKey: publicationKeys.all(workspaceId),
        }),
        ...(variables.action === 'revoke'
          ? [
              client.removeQueries({
                predicate: ({ queryKey }) =>
                  queryKey[0] === receivedContentKeys.all(workspaceId)[0] &&
                  queryKey[1] === workspaceId &&
                  ['detail', 'secret', 'attachment'].includes(
                    String(queryKey[2])
                  ),
              }),
            ]
          : []),
        client.invalidateQueries({
          queryKey: receivedContentKeys.all(workspaceId),
        }),
      ])
    },
  })
  const publish = useCallback(
    () => update.mutate({ action: 'publish' }),
    [update.mutate]
  )
  const revoke = useCallback(
    (publicationId: string) =>
      update.mutateAsync({ action: 'revoke', publicationId }),
    [update.mutateAsync]
  )

  if (path.isError) return <ErrorState error={path.error} />
  if (path.isPending || !sourceCollectionId)
    return <LoadingState label='Localizando a coleção de origem…' />
  if (configuration.isError) return <ErrorState error={configuration.error} />
  if (!configuration.data)
    return <LoadingState label='Carregando publicações…' />

  const { destinationTeams, publications } = configuration.data
  const targetType = target.kind === 'collection' ? 'COLLECTION' : 'ITEM'
  const targetPublications = publications.filter(
    (publication) =>
      publication.originalId === target.id &&
      publication.originalType === targetType
  )
  return (
    <div className='space-y-5'>
      {canPublish ? (
        <section
          aria-labelledby='publication-destination'
          className='space-y-2'
        >
          <h3 className='font-semibold text-sm' id='publication-destination'>
            Publicar para um time
          </h3>
          {destinationTeams.length ? (
            <div className='flex flex-col gap-2 sm:flex-row'>
              <Select onValueChange={setTeamId} value={teamId}>
                <SelectTrigger aria-label='Time destinatário'>
                  <SelectValue placeholder='Selecione um time' />
                </SelectTrigger>
                <SelectContent>
                  {destinationTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button disabled={!teamId || update.isPending} onClick={publish}>
                Publicar
              </Button>
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              Não há outros times disponíveis.
            </p>
          )}
        </section>
      ) : null}
      <section
        aria-labelledby='active-publications'
        className='space-y-2'
        ref={activePublicationsRef}
        tabIndex={-1}
      >
        <h3 className='font-semibold text-sm' id='active-publications'>
          Times com acesso
        </h3>
        {targetPublications.length ? (
          <ul className='divide-y divide-border border-y'>
            {targetPublications.map((publication) => (
              <li
                className='flex items-center justify-between gap-3 py-2'
                key={publication.id}
              >
                <span className='min-w-0 text-sm'>
                  <span className='block truncate'>
                    {publication.sourceTeamName} →{' '}
                    {teamName(publication.destinationCollectionId, [
                      ...destinationTeams,
                      ...(teams.data ?? []),
                    ])}
                  </span>
                  <span className='block truncate text-muted-foreground text-xs'>
                    {publication.capturedPath || target.name}
                  </span>
                </span>
                {canPublish || canRevokeOrphan ? (
                  <RevokePublication
                    destinationName={teamName(
                      publication.destinationCollectionId,
                      [...destinationTeams, ...(teams.data ?? [])]
                    )}
                    disabled={update.isPending}
                    onRevoke={revoke}
                    publicationId={publication.id}
                    targetName={target.name}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-muted-foreground text-sm'>
            Este conteúdo ainda não foi publicado.
          </p>
        )}
      </section>
    </div>
  )
}

function RevokePublication({
  disabled,
  onRevoke,
  publicationId,
  targetName,
  destinationName,
}: {
  disabled: boolean
  onRevoke: (publicationId: string) => Promise<unknown>
  publicationId: string
  targetName: string
  destinationName: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const statusRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!confirming) return
    if (disabled) statusRef.current?.focus()
    else cancelRef.current?.focus()
  }, [confirming, disabled])
  const handleConfirmRevoke = useCallback(async () => {
    setError(false)
    try {
      await onRevoke(publicationId)
      setConfirming(false)
    } catch {
      setError(true)
    }
  }, [onRevoke, publicationId])
  const handleCancelRevoke = useCallback(() => setConfirming(false), [])
  const handleStartRevoke = useCallback(() => setConfirming(true), [])
  return (
    <div className='flex flex-col items-end gap-1'>
      {confirming ? (
        <span
          aria-live='polite'
          className='text-right text-xs'
          ref={statusRef}
          role='status'
          tabIndex={-1}
        >
          Revogar acesso de “{destinationName}” a “{targetName}”?
        </span>
      ) : null}
      <span className='flex gap-2'>
        {confirming ? (
          <>
            <Button
              disabled={disabled}
              onClick={handleCancelRevoke}
              ref={cancelRef}
              size='sm'
              variant='outline'
            >
              Cancelar
            </Button>
            <Button
              disabled={disabled}
              onClick={handleConfirmRevoke}
              size='sm'
              variant='destructive'
            >
              {disabled ? 'Revogando…' : 'Confirmar revogação'}
            </Button>
          </>
        ) : (
          <Button
            disabled={disabled}
            onClick={handleStartRevoke}
            size='sm'
            variant='outline'
          >
            Revogar
          </Button>
        )}
      </span>
      {error ? (
        <span className='text-destructive text-xs' role='alert'>
          Não foi possível revogar o acesso.
        </span>
      ) : null}
    </div>
  )
}

function teamName(
  collectionId: string,
  teams: { name: string; collectionId?: string; rootCollectionId?: string }[]
) {
  return (
    teams.find(
      (team) => (team.collectionId ?? team.rootCollectionId) === collectionId
    )?.name ?? 'Coleção preservada'
  )
}
