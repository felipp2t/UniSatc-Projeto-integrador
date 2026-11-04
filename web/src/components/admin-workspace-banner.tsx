import { ArrowLeftIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  selectAdminWorkspace,
  useAdminWorkspaceSelection,
} from '@/hooks/use-admin-workspace-selection'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'

export function AdminWorkspaceBanner() {
  const navigate = useNavigate()
  const selectedWorkspaceId = useAdminWorkspaceSelection()
  const workspace = useCurrentWorkspace().data
  const backToWorkspaces = useCallback(async () => {
    selectAdminWorkspace(undefined)
    await navigate({ search: {}, to: '/' })
  }, [navigate])

  if (!selectedWorkspaceId) return null

  return (
    <div
      className='border-border border-b bg-muted/60 px-4 py-2 md:px-8'
      role='status'
    >
      <div className='container mx-auto flex flex-wrap items-center justify-between gap-2 text-xs'>
        <span className='inline-flex items-center gap-2'>
          <ShieldCheckIcon aria-hidden='true' size={14} />
          Você está acessando{' '}
          <strong>{workspace?.name ?? 'o workspace'}</strong> como administrador
          geral.
        </span>
        <Button onClick={backToWorkspaces} size='sm' variant='ghost'>
          <ArrowLeftIcon aria-hidden='true' size={12} />
          Voltar aos workspaces
        </Button>
      </div>
    </div>
  )
}
