import { ArchiveIcon, FloppyDiskIcon } from '@phosphor-icons/react'
import { useForm, useSelector } from '@tanstack/react-form'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useId, useState } from 'react'
import { z } from 'zod'
import { workspaceApi } from '@/api/endpoints'
import type { WorkspaceResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { Textarea } from '@/components/ui/textarea'
import { WorkspaceSettingsLayout } from '@/components/workspace-settings-layout'
import { useCurrentWorkspace } from '@/hooks/use-current-workspace'
import { useUpdateWorkspace } from '@/hooks/use-update-workspace'
import { useWorkspaceMembers } from '@/hooks/use-workspace-members'
import { useWorkspacePermissions } from '@/hooks/use-workspace-permissions'

export const Route = createFileRoute(
  '/_protected/configuracoes-workspace_/geral'
)({
  component: WorkspaceGeneralSettingsPage,
  head: () => ({
    meta: [{ title: 'Geral | Configurações do workspace | Vaulty' }],
  }),
})

const workspaceSettingsSchema = z.object({
  description: z
    .string()
    .trim()
    .max(2000, 'A descrição deve ter no máximo 2000 caracteres.'),
  name: z
    .string()
    .trim()
    .min(3, 'O nome deve ter pelo menos 3 caracteres.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.'),
})

interface WorkspaceSettingsValues {
  description: string
  name: string
}

function hasWorkspaceChanges(
  values: WorkspaceSettingsValues,
  workspace: WorkspaceResponse
) {
  return (
    values.name.trim() !== (workspace.name ?? '').trim() ||
    values.description.trim() !== (workspace.description ?? '').trim()
  )
}

function WorkspaceGeneralSettingsPage() {
  const workspaceQuery = useCurrentWorkspace()
  const workspace = workspaceQuery.data
  const userId = Route.useRouteContext().session.user?.id
  const { isOwner, members } = useWorkspaceMembers(workspace?.id, userId)
  const permissions = useWorkspacePermissions(workspace?.id)
  const [backupPending, setBackupPending] = useState(false)
  const [backupError, setBackupError] = useState(false)
  const [backupComplete, setBackupComplete] = useState(false)
  const generateBackup = useCallback(async () => {
    if (!workspace?.id || backupPending) return
    setBackupPending(true)
    setBackupError(false)
    setBackupComplete(false)
    try {
      const { data } = await workspaceApi.backup()
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'vaulty-backup.zip'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setBackupComplete(true)
    } catch {
      setBackupError(true)
    } finally {
      setBackupPending(false)
    }
  }, [backupPending, workspace?.id])
  const retryWorkspace = useCallback(async () => {
    await workspaceQuery.refetch()
  }, [workspaceQuery.refetch])

  if (workspaceQuery.isPending)
    return <LoadingState label='Carregando workspace…' />
  if (workspaceQuery.isError) {
    return (
      <ErrorState
        error={workspaceQuery.error}
        message='Não foi possível carregar seu workspace.'
        onRetry={retryWorkspace}
      />
    )
  }
  if (!workspace?.id) {
    return (
      <main className='container mx-auto px-4 py-8 md:px-8 md:py-12'>
        <EmptyState
          description='Você precisa estar vinculado a um workspace para consultar suas configurações.'
          title='Nenhum workspace disponível'
        />
      </main>
    )
  }
  if (members.isPending) {
    return <LoadingState label='Carregando permissões…' />
  }

  return (
    <WorkspaceSettingsLayout
      breadcrumbLabel='Geral'
      breadcrumbParentLabel='Configurações do Workspace'
      canManageGroups={permissions.can('group', 'manage')}
      canManageRoles={isOwner}
    >
      <section
        aria-labelledby='workspace-general-title'
        className='min-w-0 flex-1 space-y-5'
      >
        <h2
          className='font-mono font-semibold text-sm uppercase tracking-wide'
          id='workspace-general-title'
        >
          Geral
        </h2>
        {members.isError ? (
          <p className='text-muted-foreground text-xs' role='status'>
            Não foi possível confirmar a permissão de edição. Os campos estão em
            modo de leitura.
          </p>
        ) : null}
        <WorkspaceGeneralForm
          canUpdate={isOwner && !members.isError}
          key={workspace.id}
          workspace={workspace}
        />
        {isOwner && !members.isError ? (
          <section
            aria-labelledby='workspace-backup-title'
            className='space-y-3 border-border border-t pt-5'
          >
            <div className='space-y-1'>
              <h3 className='font-semibold text-sm' id='workspace-backup-title'>
                Backup do workspace
              </h3>
              <p className='text-muted-foreground text-sm'>
                Gere um arquivo ZIP com os dados e anexos deste workspace para
                guardar onde preferir.
              </p>
            </div>
            <Button
              disabled={backupPending}
              onClick={generateBackup}
              type='button'
            >
              <ArchiveIcon aria-hidden='true' size={16} />
              {backupPending ? 'Gerando backup…' : 'Baixar backup'}
            </Button>
            <p
              aria-live='polite'
              className='text-muted-foreground text-sm'
              role='status'
            >
              {backupPending
                ? 'A geração do backup está em andamento. Aguarde antes de sair desta página.'
                : backupComplete
                  ? 'Backup concluído. O download foi iniciado.'
                  : null}
            </p>
            {backupError ? (
              <p className='text-destructive text-sm' role='alert'>
                Não foi possível concluir o backup. Tente novamente.
              </p>
            ) : null}
          </section>
        ) : null}
      </section>
    </WorkspaceSettingsLayout>
  )
}

function WorkspaceGeneralForm({
  canUpdate,
  workspace,
}: {
  canUpdate: boolean
  workspace: WorkspaceResponse
}) {
  const nameId = useId()
  const descriptionId = useId()
  const { error, reset, update } = useUpdateWorkspace()
  const form = useForm({
    defaultValues: {
      description: workspace.description ?? '',
      name: workspace.name ?? '',
    },
    onSubmit: async ({ formApi, value }) => {
      const { id } = workspace
      if (!(canUpdate && id && hasWorkspaceChanges(value, workspace))) return
      const saved = await update({
        id,
        values: {
          description: value.description.trim() || undefined,
          name: value.name.trim(),
        },
      }).catch(() => undefined)
      if (!saved) return
      formApi.reset({
        description: saved.data.description ?? '',
        name: saved.data.name ?? '',
      })
    },
    validators: { onSubmit: workspaceSettingsSchema },
  })
  const submitting = useSelector(form.store, (state) => state.isSubmitting)
  const hasChanges = useSelector(form.store, (state) =>
    hasWorkspaceChanges(state.values, workspace)
  )
  const readOnly = !canUpdate || submitting
  const handleSubmit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      reset()
      form.handleSubmit().catch(() => undefined)
    },
    [form, reset]
  )

  return (
    <form className='space-y-4' noValidate onSubmit={handleSubmit}>
      <form.Field name='name'>
        {(field) => {
          const invalid = field.state.meta.errors.length > 0
          return (
            <Field invalid={invalid}>
              <FieldLabel htmlFor={nameId}>Nome do workspace</FieldLabel>
              <Input
                aria-describedby={invalid ? `${nameId}-error` : undefined}
                aria-invalid={invalid || undefined}
                id={nameId}
                maxLength={100}
                onBlur={field.handleBlur}
                onValueChange={field.handleChange}
                readOnly={readOnly}
                required
                value={field.state.value}
              />
              <FieldError
                errors={field.state.meta.errors}
                id={`${nameId}-error`}
              />
            </Field>
          )
        }}
      </form.Field>
      <form.Field name='description'>
        {(field) => {
          const invalid = field.state.meta.errors.length > 0
          return (
            <Field invalid={invalid}>
              <FieldLabel htmlFor={descriptionId}>Descrição</FieldLabel>
              <Textarea
                aria-describedby={
                  invalid ? `${descriptionId}-error` : undefined
                }
                aria-invalid={invalid || undefined}
                id={descriptionId}
                maxLength={2000}
                onBlur={field.handleBlur}
                onValueChange={field.handleChange}
                readOnly={readOnly}
                value={field.state.value}
              />
              <FieldError
                errors={field.state.meta.errors}
                id={`${descriptionId}-error`}
              />
            </Field>
          )
        }}
      </form.Field>
      {error ? (
        <p className='text-destructive text-xs' role='alert'>
          {error}
        </p>
      ) : null}
      {canUpdate ? (
        <Button disabled={!hasChanges || submitting} type='submit'>
          <FloppyDiskIcon aria-hidden='true' size={16} />
          {submitting ? 'Salvando…' : 'Salvar'}
        </Button>
      ) : null}
    </form>
  )
}
