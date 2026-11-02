import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getApiErrorMessage } from '@/api/get-api-error-message'
import {
  type RolePermission,
  rolePermissionCatalogQueryKey,
  rolePermissionsApi,
  rolePermissionsQueryKey,
} from '@/api/role-permissions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { appToast } from '@/components/ui/toast'

const resources = [
  'workspace',
  'collection',
  'item',
  'member',
  'role',
  'activity',
] as const satisfies readonly RolePermission['resource'][]

const actions = [
  'read',
  'create',
  'update',
  'delete',
  'invite',
] as const satisfies readonly RolePermission['action'][]

type CheckboxValue = boolean | 'indeterminate'

const labels: Record<string, string> = {
  activity: 'Atividades',
  collection: 'Pastas',
  create: 'Criar',
  delete: 'Excluir',
  invite: 'Convidar',
  item: 'Itens',
  member: 'Membros',
  read: 'Consultar',
  role: 'Papéis',
  update: 'Editar',
  workspace: 'Workspace',
}

function permissionKey(permission: RolePermission) {
  return `${permission.resource}:${permission.action}`
}

function toSet(permissions: RolePermission[]) {
  return new Set(permissions.map(permissionKey))
}

function fromSet(keys: Set<string>): RolePermission[] {
  return [...keys].map((key) => {
    const [resource, action] = key.split(':') as [
      RolePermission['resource'],
      RolePermission['action'],
    ]
    return { action, resource }
  })
}

function getAllowedPermissions(permissions: RolePermission[] | undefined) {
  return new Set(
    (permissions ?? [])
      .filter(
        (permission) =>
          resources.includes(
            permission.resource as (typeof resources)[number]
          ) &&
          actions.includes(permission.action as (typeof actions)[number]) &&
          (permission.action !== 'invite' || permission.resource === 'member')
      )
      .map(permissionKey)
  )
}

export function RolePermissionsEditor({
  builtIn,
  canManage,
  onOpenChange,
  open,
  readOnly = false,
  roleId,
  roleName,
  workspaceId,
}: {
  builtIn: boolean
  canManage: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
  readOnly?: boolean
  roleId: string
  roleName: string
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const catalog = useQuery({
    enabled: open,
    queryFn: () => rolePermissionsApi.catalog(workspaceId),
    queryKey: rolePermissionCatalogQueryKey(workspaceId),
  })
  const current = useQuery({
    enabled: open,
    queryFn: () => rolePermissionsApi.get(workspaceId, roleId),
    queryKey: rolePermissionsQueryKey(workspaceId, roleId),
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const canEdit = canManage && !builtIn && !readOnly

  const allowed = useMemo(
    () => getAllowedPermissions(catalog.data),
    [catalog.data]
  )

  useEffect(() => {
    setSelected(
      toSet(
        (current.data ?? []).filter((permission) =>
          allowed.has(permissionKey(permission))
        )
      )
    )
  }, [allowed, current.data])

  const baseline = useMemo(
    () =>
      new Set(
        [...(current.data ? toSet(current.data) : [])].filter((key) =>
          allowed.has(key)
        )
      ),
    [allowed, current.data]
  )
  const additions = [...selected].filter((key) => !baseline.has(key))
  const removals = [...baseline].filter((key) => !selected.has(key))
  const hasChanges = additions.length > 0 || removals.length > 0

  const save = useMutation({
    mutationFn: (permissions: RolePermission[]) =>
      rolePermissionsApi.replace(workspaceId, roleId, permissions),
    onError: (error) =>
      appToast.error(
        getApiErrorMessage(error, {
          fallback: 'Não foi possível salvar as permissões.',
        })
      ),
    onSuccess: async (response) => {
      queryClient.setQueryData(
        rolePermissionsQueryKey(workspaceId, roleId),
        response.permissions
      )
      await queryClient.invalidateQueries({
        queryKey: rolePermissionsQueryKey(workspaceId, roleId),
      })
      await queryClient.invalidateQueries({
        queryKey: ['workspace-role-permission-counts', workspaceId],
      })
      appToast.success('Permissões salvas com sucesso.')
    },
  })

  const setPermission = useCallback(
    (
      resource: RolePermission['resource'],
      action: RolePermission['action'],
      checked: boolean
    ) => {
      const key = permissionKey({ action, resource })
      setSelected((previous) => {
        const next = new Set(previous)
        if (checked) next.add(key)
        else next.delete(key)
        return next
      })
    },
    []
  )

  const permissionHandlers = useMemo(() => {
    const handlers = new Map<string, (checked: CheckboxValue) => void>()
    for (const resource of resources) {
      for (const action of actions) {
        handlers.set(permissionKey({ action, resource }), (checked) =>
          setPermission(resource, action, checked === true)
        )
      }
    }
    return handlers
  }, [setPermission])

  const setRow = useCallback(
    (resource: RolePermission['resource'], checked: boolean) => {
      setSelected((previous) => {
        const next = new Set(previous)
        for (const action of actions) {
          const permission = { action, resource }
          const key = permissionKey(permission)
          if (!allowed.has(key)) continue
          if (checked) next.add(key)
          else next.delete(key)
        }
        return next
      })
    },
    [allowed]
  )

  const rowHandlers = useMemo(
    () =>
      new Map(
        resources.map((resource) => [
          resource,
          (checked: CheckboxValue) => setRow(resource, checked === true),
        ])
      ),
    [setRow]
  )

  const handleSave = useCallback(() => {
    if (!(canEdit && hasChanges) || save.isPending) return

    const hidden = (current.data ?? []).filter(
      (permission) => !allowed.has(permissionKey(permission))
    )
    save.mutate([...hidden, ...fromSet(selected)])
  }, [allowed, canEdit, current.data, hasChanges, save, selected])

  const isLoading = catalog.isLoading || current.isLoading
  const loadError = catalog.error ?? current.error
  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className='max-w-5xl'>
        <DialogHeader>
          <DialogTitle>
            {readOnly ? 'Permissões do cargo' : 'Ajustar permissões'}:{' '}
            {roleName}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? 'Consulte as ações permitidas para este cargo.'
              : 'Ajuste as ações disponíveis para este papel. Alterações são aplicadas em lote.'}
          </DialogDescription>
        </DialogHeader>
        <RolePermissionsDialogContent
          additions={additions}
          allowed={allowed}
          builtIn={builtIn}
          canEdit={canEdit}
          close={close}
          hasChanges={hasChanges}
          isLoading={isLoading}
          loadError={loadError}
          onSave={handleSave}
          permissionHandlers={permissionHandlers}
          readOnly={readOnly}
          removals={removals}
          roleName={roleName}
          rowHandlers={rowHandlers}
          savePending={save.isPending}
          selected={selected}
        />
      </DialogContent>
    </Dialog>
  )
}

function RolePermissionsDialogContent({
  additions,
  allowed,
  builtIn,
  canEdit,
  close,
  hasChanges,
  isLoading,
  loadError,
  onSave,
  permissionHandlers,
  readOnly,
  removals,
  roleName,
  rowHandlers,
  savePending,
  selected,
}: {
  additions: string[]
  allowed: Set<string>
  builtIn: boolean
  canEdit: boolean
  close: () => void
  hasChanges: boolean
  isLoading: boolean
  loadError: unknown
  onSave: () => void
  permissionHandlers: Map<string, (checked: CheckboxValue) => void>
  readOnly: boolean
  removals: string[]
  roleName: string
  rowHandlers: Map<(typeof resources)[number], (checked: CheckboxValue) => void>
  savePending: boolean
  selected: Set<string>
}) {
  return (
    <>
      {builtIn && !readOnly ? (
        <p className='text-muted-foreground text-sm' role='status'>
          As permissões dos papéis iniciais não podem ser alteradas.
        </p>
      ) : null}
      {isLoading ? (
        <p className='text-muted-foreground text-sm' role='status'>
          Carregando permissões…
        </p>
      ) : loadError ? (
        <p className='text-destructive text-sm' role='alert'>
          {getApiErrorMessage(loadError, {
            fallback: 'Não foi possível carregar as permissões.',
          })}
        </p>
      ) : (
        <>
          <PermissionMatrix
            allowed={allowed}
            canEdit={canEdit}
            permissionHandlers={permissionHandlers}
            roleName={roleName}
            rowHandlers={rowHandlers}
            selected={selected}
          />
          {readOnly ? null : (
            <section
              aria-label='Resumo das alterações'
              className='border border-border'
            >
              <h3 className='border-border border-b p-3 font-semibold text-sm'>
                Alterações pendentes
              </h3>
              <ScrollArea
                aria-label='Lista de alterações pendentes'
                className='h-24'
                role='region'
                type='always'
              >
                <div className='p-3'>
                  {hasChanges ? (
                    <ul className='space-y-1 text-sm'>
                      {additions.map((key) => (
                        <li className='text-primary' key={`add-${key}`}>
                          + {formatPermission(key)}
                        </li>
                      ))}
                      {removals.map((key) => (
                        <li className='text-destructive' key={`remove-${key}`}>
                          − {formatPermission(key)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className='text-muted-foreground text-sm'>
                      Nenhuma alteração pendente.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </section>
          )}
        </>
      )}
      <DialogFooter>
        <Button onClick={close} variant='outline'>
          Fechar
        </Button>
        {readOnly ? null : (
          <Button
            disabled={
              !(canEdit && hasChanges) ||
              isLoading ||
              Boolean(loadError) ||
              savePending
            }
            onClick={onSave}
          >
            {savePending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

function PermissionMatrix({
  allowed,
  canEdit,
  permissionHandlers,
  roleName,
  rowHandlers,
  selected,
}: {
  allowed: Set<string>
  canEdit: boolean
  permissionHandlers: Map<string, (checked: CheckboxValue) => void>
  roleName: string
  rowHandlers: Map<(typeof resources)[number], (checked: CheckboxValue) => void>
  selected: Set<string>
}) {
  return (
    <section
      aria-label={`Matriz de permissões de ${roleName}`}
      className='max-h-[55vh] border border-border'
    >
      <ScrollArea className='max-h-[55vh]' type='always'>
        <table className='w-full min-w-[760px] border-collapse text-sm'>
          <thead className='sticky top-0 bg-muted/70'>
            <tr>
              <th className='p-3 text-left' scope='col'>
                Recurso
              </th>
              {[...actions, 'all' as const].map((action) => (
                <th className='p-3 text-center' key={action} scope='col'>
                  {action === 'all' ? 'Todos' : labels[action]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((resource) => {
              const rowKeys = actions
                .filter((action) =>
                  allowed.has(permissionKey({ action, resource }))
                )
                .map((action) => permissionKey({ action, resource }))
              const rowChecked =
                rowKeys.length > 0 && rowKeys.every((key) => selected.has(key))
              const rowMixed =
                rowKeys.some((key) => selected.has(key)) && !rowChecked
              return (
                <tr className='border-border border-t' key={resource}>
                  <th className='p-3 text-left font-medium' scope='row'>
                    {labels[resource]}
                  </th>
                  {actions.map((action) => {
                    const key = permissionKey({ action, resource })
                    return (
                      <td className='p-3 text-center' key={action}>
                        {allowed.has(key) ? (
                          <Checkbox
                            aria-label={`${labels[action]}: ${labels[resource]}`}
                            checked={selected.has(key)}
                            disabled={!canEdit}
                            onCheckedChange={permissionHandlers.get(key)}
                          />
                        ) : null}
                      </td>
                    )
                  })}
                  <td className='p-3 text-center'>
                    <Checkbox
                      aria-label={`Todas as ações: ${labels[resource]}`}
                      checked={rowMixed ? 'indeterminate' : rowChecked}
                      disabled={!canEdit || rowKeys.length === 0}
                      onCheckedChange={rowHandlers.get(resource)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollArea>
    </section>
  )
}

function formatPermission(key: string) {
  const [resource, action] = key.split(':')
  return `${labels[action]} — ${labels[resource]}`
}
