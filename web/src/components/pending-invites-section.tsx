import { TrashIcon } from '@phosphor-icons/react'
import {
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { inviteApi } from '@/api/endpoints'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import { inviteQueryKey, isInviteExpired } from '@/api/invites'
import type { InviteResponse } from '@/api/types'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { appToast } from '@/components/ui/toast'
import { useExpiryTick } from '@/hooks/use-expiry-tick'

export function PendingInvitesSection() {
  const queryClient = useQueryClient()
  const [selectedInvite, setSelectedInvite] = useState<InviteResponse>()
  const invites = useQuery({
    queryFn: async () => (await inviteApi.list()).data,
    queryKey: inviteQueryKey,
  })
  const expirations = useMemo(
    () => [
      ...(invites.data?.map((invite) => invite.expiresAt) ?? []),
      ...(selectedInvite ? [selectedInvite.expiresAt] : []),
    ],
    [invites.data, selectedInvite]
  )
  const now = useExpiryTick(expirations)

  const retryLoad = useCallback(async () => {
    await invites.refetch()
  }, [invites.refetch])
  const revokeInvite = useMutation<
    Awaited<ReturnType<typeof inviteApi.revoke>>,
    unknown,
    string,
    { previousInvites: InviteResponse[] | undefined }
  >({
    mutationFn: inviteApi.revoke,
    onError: (_error, _inviteId, context) => {
      if (context?.previousInvites) {
        queryClient.setQueryData(inviteQueryKey, context.previousInvites)
      }
      appToast.error('Não foi possível revogar o convite.')
    },
    onMutate: async (inviteId) => {
      await queryClient.cancelQueries({ queryKey: inviteQueryKey })
      const previousInvites =
        queryClient.getQueryData<InviteResponse[]>(inviteQueryKey)
      queryClient.setQueryData<InviteResponse[]>(inviteQueryKey, (current) =>
        current?.filter((invite) => invite.id !== inviteId)
      )
      return { previousInvites }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: inviteQueryKey }),
    onSuccess: () => {
      appToast.success('Convite revogado com sucesso.')
      setSelectedInvite(undefined)
    },
  })
  const closeDialog = useCallback(() => {
    if (!revokeInvite.isPending) setSelectedInvite(undefined)
  }, [revokeInvite.isPending])
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeDialog()
    },
    [closeDialog]
  )
  const selectInvite = useCallback(
    (invite: InviteResponse) => {
      if (isInviteExpired(invite.expiresAt, now)) return
      revokeInvite.reset()
      setSelectedInvite(invite)
    },
    [now, revokeInvite.reset]
  )
  const confirmRevoke = useCallback(() => {
    if (
      !selectedInvite ||
      revokeInvite.isPending ||
      isInviteExpired(selectedInvite.expiresAt, now)
    ) {
      return
    }
    revokeInvite.mutate(selectedInvite.id)
  }, [now, revokeInvite.isPending, revokeInvite.mutate, selectedInvite])

  const mutationError = revokeInvite.error
    ? getRevokeError(revokeInvite.error)
    : undefined

  return (
    <>
      <PendingInvitesList
        invites={invites}
        isRevoking={revokeInvite.isPending}
        now={now}
        onRetry={retryLoad}
        onSelectInvite={selectInvite}
      />
      <RevokeInviteDialog
        closeDialog={closeDialog}
        error={mutationError}
        handleConfirmRevoke={confirmRevoke}
        handleOpenChange={handleOpenChange}
        isPending={revokeInvite.isPending}
        now={now}
        selectedInvite={selectedInvite}
      />
    </>
  )
}

function PendingInvitesList({
  invites,
  isRevoking,
  now,
  onRetry,
  onSelectInvite,
}: {
  invites: UseQueryResult<InviteResponse[]>
  isRevoking: boolean
  now: number
  onRetry: () => Promise<void>
  onSelectInvite: (invite: InviteResponse) => void
}) {
  if (invites.isPending) return <LoadingState label='Carregando convites…' />
  if (invites.isError) {
    return (
      <ErrorState
        error={invites.error}
        message='Não foi possível carregar os convites pendentes.'
        onRetry={onRetry}
      />
    )
  }
  if (invites.data.length === 0) {
    return (
      <div className='flex items-center justify-center border border-border bg-card p-6'>
        <p className='font-mono text-muted-foreground text-xs'>
          Nenhum convite pendente
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className='max-h-120'>
      <ul className='m-0 list-none divide-y divide-border border border-border p-0'>
        {invites.data.map((invite) => (
          <PendingInviteRow
            invite={invite}
            isRevoking={isRevoking}
            key={invite.id}
            now={now}
            onSelect={onSelectInvite}
          />
        ))}
      </ul>
    </ScrollArea>
  )
}

function PendingInviteRow({
  invite,
  isRevoking,
  now,
  onSelect,
}: {
  invite: InviteResponse
  isRevoking: boolean
  now: number
  onSelect: (invite: InviteResponse) => void
}) {
  const expired = isInviteExpired(invite.expiresAt, now)
  const selectInvite = useCallback(() => onSelect(invite), [invite, onSelect])

  return (
    <li className='flex items-center gap-3 bg-card px-4 py-3'>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <span className='truncate font-mono font-semibold text-xs tracking-wide'>
          {invite.email}
        </span>
        <div className='flex flex-wrap gap-x-3 gap-y-1 font-mono text-muted-foreground text-xs'>
          <span className='min-w-0 max-w-full break-words'>
            Convidado por {invite.invitedByName || 'Pessoa desconhecida'}
          </span>
          <span>
            Criado em{' '}
            {new Intl.DateTimeFormat('pt-BR', {
              dateStyle: 'medium',
            }).format(new Date(invite.createdAt))}
          </span>
          <span>
            {expired
              ? 'Convite expirado'
              : `Expira em ${new Intl.DateTimeFormat('pt-BR', {
                  dateStyle: 'medium',
                }).format(new Date(invite.expiresAt))}`}
          </span>
        </div>
      </div>
      <Button
        aria-label={`Revogar convite para ${invite.email}`}
        className='size-7 rounded-none border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive'
        disabled={expired || isRevoking}
        onClick={selectInvite}
        size='icon'
        variant='outline'
      >
        <TrashIcon aria-hidden='true' className='size-3.5' />
      </Button>
    </li>
  )
}

function RevokeInviteDialog({
  closeDialog,
  error,
  handleConfirmRevoke,
  handleOpenChange,
  isPending,
  now,
  selectedInvite,
}: {
  closeDialog: () => void
  error: string | undefined
  handleConfirmRevoke: () => void
  handleOpenChange: (open: boolean) => void
  isPending: boolean
  now: number
  selectedInvite: InviteResponse | undefined
}) {
  if (!selectedInvite) return null
  const expired = isInviteExpired(selectedInvite.expiresAt, now)
  return (
    <Dialog onOpenChange={handleOpenChange} open>
      <DialogContent
        className='gap-4 rounded-none p-7 shadow-none sm:max-w-[30rem]'
        showCloseButton={false}
      >
        <div className='flex flex-col gap-4 pt-2'>
          <DialogHeader>
            <DialogTitle className='text-[13px] tracking-[0.05em]'>
              Revogar convite
            </DialogTitle>
            <DialogDescription className='font-medium text-[10px]'>
              {expired
                ? `O convite para ${selectedInvite.email} expirou e não pode mais ser revogado.`
                : `Tem certeza de que deseja revogar o convite enviado para ${selectedInvite.email}?`}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className='text-destructive text-xs' role='alert'>
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              className='rounded-none'
              disabled={isPending}
              onClick={closeDialog}
              variant='outline'
            >
              Cancelar
            </Button>
            <Button
              className='rounded-none'
              disabled={expired || isPending}
              loading={isPending}
              onClick={handleConfirmRevoke}
              variant='destructive'
            >
              {isPending ? 'Revogando…' : 'Revogar convite'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getRevokeError(cause: unknown) {
  return getApiErrorMessage(cause, {
    fallback: 'Não foi possível revogar o convite. Tente novamente.',
    statusMessages: {
      403: 'Você não tem permissão para revogar este convite.',
      404: 'Este convite não está mais disponível. Atualize a lista e tente novamente.',
      409: 'Este convite não está mais disponível. Atualize a lista e tente novamente.',
    },
    useServerMessage: true,
  })
}
