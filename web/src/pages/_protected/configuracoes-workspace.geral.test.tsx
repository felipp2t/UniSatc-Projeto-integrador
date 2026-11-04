// @vitest-environment happy-dom

import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import {
  ownerId,
  renderWorkspaceSettings,
  setupWorkspaceSettingsMocks,
  workspaceId,
} from '@/test/workspace-settings-fixtures'
import {
  toastError,
  toastSuccess,
  workspaceApiMocks,
} from '@/test/workspace-settings-mocks'

vi.mock('@/components/ui/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/toast')>()
  const shared = await import('@/test/workspace-settings-mocks')
  return {
    ...actual,
    appToast: {
      ...actual.appToast,
      error: shared.toastError,
      success: shared.toastSuccess,
    },
  }
})

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  const shared = await import('@/test/workspace-settings-mocks')
  return {
    ...actual,
    workspaceApi: {
      ...actual.workspaceApi,
      backup: shared.workspaceApiMocks.backup,
      list: shared.workspaceApiMocks.list,
      listMembers: shared.workspaceApiMocks.listMembers,
      listRoles: shared.workspaceApiMocks.listRoles,
      update: shared.workspaceApiMocks.update,
    },
  }
})

beforeEach(setupWorkspaceSettingsMocks)
afterEach(() => vi.restoreAllMocks())

const generalPath = '/configuracoes-workspace/geral'

describe('workspace general settings', () => {
  it('allows only the owner to access the backup action', async () => {
    await renderWorkspaceSettings('member-2', generalPath)

    await screen.findByRole('textbox', { name: 'Nome do workspace' })
    expect(screen.queryByRole('button', { name: 'Baixar backup' })).toBeNull()
    expect(workspaceApiMocks.backup).not.toHaveBeenCalled()
  })

  it('starts one backup at a time and downloads the completed ZIP', async () => {
    const user = userEvent.setup()
    let resolveBackup: ((result: { data: Blob }) => void) | undefined
    workspaceApiMocks.backup.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBackup = resolve
      })
    )
    const createObjectURL = vi.fn(() => 'blob:backup')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    await renderWorkspaceSettings(ownerId, generalPath)

    const backupButton = await screen.findByRole('button', {
      name: 'Baixar backup',
    })
    await user.click(backupButton)
    expect(
      await screen.findByRole('button', { name: 'Gerando backup…' })
    ).toBeDisabled()
    expect(
      screen.getByText(
        'A geração do backup está em andamento. Aguarde antes de sair desta página.'
      )
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gerando backup…' }))
    expect(workspaceApiMocks.backup).toHaveBeenCalledTimes(1)

    resolveBackup?.({
      data: new Blob(['zip content'], { type: 'application/zip' }),
    })
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download="vaulty-backup.zip"]')).toBeNull()
    expect(
      await screen.findByRole('button', { name: 'Baixar backup' })
    ).toBeEnabled()
    vi.unstubAllGlobals()
  })

  it('does not download a failed backup and permits retry', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.backup
      .mockRejectedValueOnce(new Error('incomplete response'))
      .mockResolvedValueOnce({ data: new Blob(['complete']) })
    const createObjectURL = vi.fn(() => 'blob:backup')
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    await renderWorkspaceSettings(ownerId, generalPath)

    await user.click(
      await screen.findByRole('button', { name: 'Baixar backup' })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir o backup. Tente novamente.'
    )
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Baixar backup' }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    expect(workspaceApiMocks.backup).toHaveBeenCalledTimes(2)
    expect(click).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('hides the backup action when confirming member permissions fails', async () => {
    workspaceApiMocks.listMembers.mockRejectedValueOnce(
      new Error('Members request failed')
    )
    await renderWorkspaceSettings(ownerId, generalPath)

    await screen.findByText(
      'Não foi possível confirmar a permissão de edição. Os campos estão em modo de leitura.'
    )
    expect(screen.queryByRole('button', { name: 'Baixar backup' })).toBeNull()
    expect(workspaceApiMocks.backup).not.toHaveBeenCalled()
  })

  it('shows workspace name and description as read-only to members', async () => {
    await renderWorkspaceSettings('member-2', generalPath)

    const name = await screen.findByRole('textbox', {
      name: 'Nome do workspace',
    })
    const description = screen.getByRole('textbox', { name: 'Descrição' })
    expect(name).toHaveValue('Workspace')
    expect(name).toHaveAttribute('readonly')
    expect(description).toHaveValue('Workspace description')
    expect(description).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
    expect(workspaceApiMocks.update).not.toHaveBeenCalled()
  })

  it('keeps fields read-only when confirming member permissions fails', async () => {
    workspaceApiMocks.listMembers.mockRejectedValueOnce(
      new Error('Members request failed')
    )
    await renderWorkspaceSettings(ownerId, generalPath)

    expect(
      await screen.findByText(
        'Não foi possível confirmar a permissão de edição. Os campos estão em modo de leitura.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Nome do workspace' })
    ).toHaveAttribute('readonly')
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toHaveAttribute(
      'readonly'
    )
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
    expect(workspaceApiMocks.update).not.toHaveBeenCalled()
  })

  it('saves valid name and optional description and updates the workspace cache', async () => {
    const user = userEvent.setup()
    const savedWorkspace = {
      description: 'Server description',
      id: workspaceId,
      name: 'Server workspace',
      ownerId,
    }
    workspaceApiMocks.update.mockResolvedValueOnce({ data: savedWorkspace })
    const { queryClient } = await renderWorkspaceSettings(ownerId, generalPath)
    const name = await screen.findByRole('textbox', {
      name: 'Nome do workspace',
    })
    const description = screen.getByRole('textbox', { name: 'Descrição' })
    await user.clear(name)
    await user.type(name, 'New workspace')
    await user.clear(description)
    await user.type(description, 'Updated description')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(workspaceApiMocks.update).toHaveBeenCalledWith(workspaceId, {
        description: 'Updated description',
        name: 'New workspace',
      })
    )
    expect(toastSuccess).toHaveBeenCalledWith(
      'Configurações do workspace salvas.'
    )
    expect(queryClient.getQueryData(['workspaces'])).toEqual([savedWorkspace])
    expect(name).toHaveValue(savedWorkspace.name)
    expect(description).toHaveValue(savedWorkspace.description)
  })

  it('clears the description by sending an undefined description', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId, generalPath)
    const description = await screen.findByRole('textbox', {
      name: 'Descrição',
    })
    await user.clear(description)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(workspaceApiMocks.update).toHaveBeenCalledWith(workspaceId, {
        description: undefined,
        name: 'Workspace',
      })
    )
  })

  it('keeps save disabled and does not update without changes', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId, generalPath)
    const name = await screen.findByRole('textbox', {
      name: 'Nome do workspace',
    })

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    await user.type(name, '{Enter}')
    fireEvent.submit(name.closest('form') as HTMLFormElement)

    expect(workspaceApiMocks.update).not.toHaveBeenCalled()
  })

  it('keeps save disabled when the server name has edge whitespace', async () => {
    workspaceApiMocks.list.mockResolvedValue({
      data: [
        {
          description: 'Workspace description',
          id: workspaceId,
          name: '  Workspace  ',
          ownerId,
        },
      ],
    })
    await renderWorkspaceSettings(ownerId, generalPath)
    await screen.findByRole('textbox', { name: 'Nome do workspace' })

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(workspaceApiMocks.update).not.toHaveBeenCalled()
  })

  it('keeps save disabled when edits normalize to the original values', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId, generalPath)
    const name = await screen.findByRole('textbox', {
      name: 'Nome do workspace',
    })
    const description = screen.getByRole('textbox', { name: 'Descrição' })
    const save = screen.getByRole('button', { name: 'Salvar' })

    await user.type(name, 'X')
    expect(save).toBeEnabled()
    await user.clear(name)
    await user.type(name, 'Workspace')
    expect(save).toBeDisabled()

    await user.clear(name)
    await user.type(name, '  Workspace  ')
    await user.clear(description)
    await user.type(description, '  Workspace description  ')
    expect(save).toBeDisabled()
    fireEvent.submit(name.closest('form') as HTMLFormElement)

    expect(workspaceApiMocks.update).not.toHaveBeenCalled()
  })

  it('resets the form to the saved values and disables save after saving', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.update.mockResolvedValueOnce({
      data: {
        description: 'Saved description',
        id: workspaceId,
        name: 'Saved name',
        ownerId,
      },
    })
    await renderWorkspaceSettings(ownerId, generalPath)
    const name = await screen.findByRole('textbox', {
      name: 'Nome do workspace',
    })
    await user.clear(name)
    await user.type(name, '  Typed name  ')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(name).toHaveValue('Saved name'))
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toHaveValue(
      'Saved description'
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    )
    expect(workspaceApiMocks.update).toHaveBeenCalledTimes(1)
  })

  it('shows the description length error under Descrição only', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId, generalPath)
    const name = await screen.findByRole('textbox', {
      name: 'Nome do workspace',
    })
    const description = screen.getByRole('textbox', { name: 'Descrição' })
    fireEvent.change(description, { target: { value: 'a'.repeat(2001) } })
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    const message = await screen.findByText(
      'A descrição deve ter no máximo 2000 caracteres.'
    )
    expect(description).toHaveAttribute('aria-invalid', 'true')
    expect(description.getAttribute('aria-describedby')).toBe(message.id)
    expect(name).not.toHaveAttribute('aria-invalid')
    expect(name).not.toHaveAttribute('aria-describedby')
    expect(workspaceApiMocks.update).not.toHaveBeenCalled()
  })

  it('rejects a name made only of spaces without sending a request', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId, generalPath)
    const name = await screen.findByRole('textbox', {
      name: 'Nome do workspace',
    })
    await user.clear(name)
    await user.type(name, '   ')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    const message = await screen.findByText(
      'O nome deve ter pelo menos 3 caracteres.'
    )
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name.getAttribute('aria-describedby')).toBe(message.id)
    expect(workspaceApiMocks.update).not.toHaveBeenCalled()
  })

  it('shows a safe message when the workspace update returns 404', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.update.mockRejectedValueOnce(
      new ApiError('Sensitive server detail', 404)
    )
    await renderWorkspaceSettings(ownerId, generalPath)
    const name = await screen.findByRole('textbox', {
      name: 'Nome do workspace',
    })
    await user.clear(name)
    await user.type(name, 'Renamed workspace')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(
      await screen.findByText('Workspace não encontrado ou vínculo inativo.')
    ).toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalledWith('Sensitive server detail')
  })

  it('navigates between General and Members sections', async () => {
    const user = userEvent.setup()
    const { router } = await renderWorkspaceSettings(ownerId, generalPath)
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Geral' })
    ).toBeInTheDocument()
    const breadcrumb =
      screen.getByRole('navigation', { name: 'breadcrumb' }).textContent ?? ''
    expect(breadcrumb.indexOf('Início')).toBeLessThan(
      breadcrumb.indexOf('Configurações do Workspace')
    )
    expect(breadcrumb.indexOf('Configurações do Workspace')).toBeLessThan(
      breadcrumb.indexOf('Geral')
    )
    expect(
      screen.getByRole('textbox', { name: 'Nome do workspace' })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Membros' }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/configuracoes-workspace')
    )
    expect(
      await screen.findByRole('textbox', { name: 'Buscar membro por nome' })
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('tab', { name: 'Membros (2)' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Geral' })
    ).toBeNull()
    expect(
      screen.queryByRole('textbox', { name: 'Nome do workspace' })
    ).toBeNull()

    await user.click(screen.getByRole('link', { name: 'Geral' }))
    expect(
      await screen.findByRole('textbox', { name: 'Nome do workspace' })
    ).toHaveValue('Workspace')
    expect(
      screen.getByRole('heading', { level: 2, name: 'Geral' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Buscar membro por nome' })
    ).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Membros (2)' })).toBeNull()
  })

  it('rejects a name shorter than three characters without sending a request', async () => {
    const user = userEvent.setup()
    await renderWorkspaceSettings(ownerId, generalPath)
    const name = await screen.findByRole('textbox', {
      name: 'Nome do workspace',
    })
    await user.clear(name)
    await user.type(name, 'ab')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(
      await screen.findByText('O nome deve ter pelo menos 3 caracteres.')
    ).toBeInTheDocument()
    expect(workspaceApiMocks.update).not.toHaveBeenCalled()
  })

  it('shows a safe message when the update is rejected', async () => {
    const user = userEvent.setup()
    workspaceApiMocks.update.mockRejectedValueOnce(
      new ApiError('Sensitive server detail', 403)
    )
    await renderWorkspaceSettings(ownerId, generalPath)
    const name = await screen.findByRole('textbox', {
      name: 'Nome do workspace',
    })
    await user.clear(name)
    await user.type(name, 'New workspace')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(
      await screen.findByText(
        'Somente o dono do workspace pode alterar estas configurações.'
      )
    ).toBeInTheDocument()
    expect(toastError).not.toHaveBeenCalledWith('Sensitive server detail')
  })
})
