import { TrashIcon } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { inviteApi } from '@/api/endpoints'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { ScrollArea } from '@/components/ui/scroll-area'
import { appToast } from '@/components/ui/toast'

export function PendingInvitesSection() {
  const queryClient = useQueryClient()
  const invites = useQuery({
    queryFn: async () => (await inviteApi.list()).data,
    queryKey: ['invites'],
  })
  const revokeInvite = useMutation({
    mutationFn: inviteApi.revoke,
    onError: () => appToast.error('Não foi possível revogar o convite.'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invites'] })
      appToast.success('Convite revogado com sucesso.')
    },
  })
  const handleRevoke = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const {
        currentTarget: {
          dataset: { inviteId },
        },
      } = event
      if (inviteId) revokeInvite.mutate(inviteId)
    },
    [revokeInvite.mutate]
  )

  if (invites.isPending) return <LoadingState label='Carregando convites…' />
  if (invites.isError) {
    return (
      <ErrorState
        error={invites.error}
        message='Não foi possível carregar os convites pendentes.'
        onRetry={invites.refetch}
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
        {invites.data.map((invite) => {
          const isRevoking =
            revokeInvite.isPending && revokeInvite.variables === invite.id

          return (
            <li
              className='flex items-center gap-3 bg-card px-4 py-3'
              key={invite.id}
            >
              <div className='flex min-w-0 flex-1 flex-col'>
                <span className='truncate font-mono font-semibold text-xs tracking-wide'>
                  {invite.email}
                </span>
                <span className='truncate font-mono text-muted-foreground text-xs'>
                  Expira em{' '}
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'medium',
                  }).format(new Date(invite.expiresAt))}
                </span>
              </div>
              <Button
                aria-label={`Revogar convite para ${invite.email}`}
                className='size-7 rounded-none border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive'
                data-invite-id={invite.id}
                disabled={isRevoking}
                loading={isRevoking}
                onClick={handleRevoke}
                size='icon'
                variant='outline'
              >
                <TrashIcon aria-hidden='true' className='size-3.5' />
              </Button>
            </li>
          )
        })}
      </ul>
    </ScrollArea>
  )
}
