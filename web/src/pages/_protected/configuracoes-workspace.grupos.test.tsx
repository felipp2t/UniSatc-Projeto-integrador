// @vitest-environment happy-dom

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import {
  ownerId,
  renderWorkspaceSettings,
  setupWorkspaceSettingsMocks,
  workspaceId,
} from '@/test/workspace-settings-fixtures'

const mocks = vi.hoisted(() => ({
  addMember: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  listGroupMembers: vi.fn(),
  listWorkspaceMembers: vi.fn(),
  permissions: vi.fn(),
  removeMember: vi.fn(),
  rename: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  workspaceList: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    accessGroupApi: {
      ...actual.accessGroupApi,
      addMember: mocks.addMember,
      create: mocks.create,
      delete: mocks.delete,
      list: mocks.list,
      listMembers: mocks.listGroupMembers,
      removeMember: mocks.removeMember,
      rename: mocks.rename,
    },
    workspaceApi: {
      ...actual.workspaceApi,
      list: mocks.workspaceList,
      listMembers: mocks.listWorkspaceMembers,
      permissions: mocks.permissions,
    },
  }
})

vi.mock('@/components/ui/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/toast')>()
  return {
    ...actual,
    appToast: {
      ...actual.appToast,
      error: mocks.toastError,
      success: mocks.toastSuccess,
    },
  }
})

const groupsPath = '/configuracoes-workspace/grupos'
const permissionDeniedPattern = /não tem permissão para gerenciar grupos/i
const retryButtonPattern = /tentar novamente|recarregar/i
const anaOptionPattern = /Ana Owner/
const biaOptionPattern = /Bia Member/
const group = { id: 'group-1', name: 'Equipe' }
const candidate = {
  email: 'bia@example.com',
  id: 'membership-2',
  name: 'Bia Member',
  roleId: 'role-member',
  roleName: 'Member',
  userId: 'member-2',
}
const groupMember = {
  email: 'ana@example.com',
  name: 'Ana Owner',
  userId: ownerId,
  workspaceMemberId: 'membership-1',
}

beforeEach(() => {
  setupWorkspaceSettingsMocks()
  mocks.toastError.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.workspaceList.mockResolvedValue({
    data: [{ id: workspaceId, name: 'Workspace', ownerId }],
  })
  mocks.permissions.mockResolvedValue({
    data: {
      isOwner: false,
      permissions: [{ action: 'manage', resource: 'group' }],
    },
  })
  mocks.list.mockResolvedValue({ data: [group] })
  mocks.create.mockResolvedValue({
    data: { id: 'group-2', name: 'Novo grupo' },
  })
  mocks.rename.mockResolvedValue({ data: { ...group, name: 'Equipe nova' } })
  mocks.delete.mockResolvedValue({ data: undefined })
  mocks.listGroupMembers.mockResolvedValue({ data: [groupMember] })
  mocks.listWorkspaceMembers.mockResolvedValue({ data: [candidate] })
  mocks.addMember.mockResolvedValue({ data: undefined })
  mocks.removeMember.mockResolvedValue({ data: undefined })
})
afterEach(() => vi.restoreAllMocks())

function renderGroups(userId = ownerId) {
  return renderWorkspaceSettings(userId, groupsPath)
}

describe('access groups settings', () => {
  it('does not list groups or expose management actions without group management permission', async () => {
    mocks.permissions.mockResolvedValue({
      data: {
        isOwner: false,
        permissions: [{ action: 'read', resource: 'group' }],
      },
    })
    const { router } = await renderGroups('member-2')

    expect(await screen.findByText(permissionDeniedPattern)).toBeInTheDocument()
    expect(mocks.list).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Novo grupo')).toBeNull()
    expect(router.state.location.pathname).toBe(groupsPath)
    expect(screen.queryByRole('link', { name: 'Grupos' })).toBeNull()
  })

  it('shows empty, loading and recoverable list error states', async () => {
    mocks.list.mockResolvedValueOnce({ data: [] })
    await renderGroups()
    expect(await screen.findByText('Nenhum grupo criado')).toBeInTheDocument()

    mocks.list.mockRejectedValueOnce(new Error('network detail'))
    const { queryClient } = await renderGroups()
    expect(
      await screen.findByText('Não foi possível carregar os grupos.')
    ).toBeInTheDocument()
    expect(screen.queryByText('network detail')).toBeNull()
    const retry = screen.getByRole('button', {
      name: retryButtonPattern,
    })
    await userEvent.setup().click(retry)
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(3))
    expect(
      queryClient.getQueryData(['workspace-access-groups', workspaceId])
    ).toEqual([group])
  })

  it('keeps the loading state while the groups request is pending', async () => {
    let resolveGroups: (value: { data: (typeof group)[] }) => void = () =>
      undefined
    mocks.list.mockReturnValue(
      new Promise((resolve) => {
        resolveGroups = resolve
      })
    )
    await renderGroups()

    expect(await screen.findByText('Carregando grupos…')).toBeInTheDocument()
    expect(screen.queryByLabelText('Novo grupo')).toBeNull()
    resolveGroups({ data: [group] })
    expect(
      await screen.findByRole('textbox', { name: 'Novo grupo' })
    ).toBeInTheDocument()
  })

  it('trims group names, accepts the 50 character boundary, validates empty and too long values, and reports conflicts', async () => {
    const user = userEvent.setup()
    await renderGroups()
    const field = await screen.findByRole('textbox', { name: 'Novo grupo' })
    await user.type(field, '   ')
    await user.click(screen.getByRole('button', { name: 'Criar grupo' }))
    expect(
      await screen.findByText('Informe um nome para o grupo.')
    ).toBeInTheDocument()
    expect(mocks.create).not.toHaveBeenCalled()

    fireEvent.change(field, { target: { value: 'x'.repeat(51) } })
    await user.click(screen.getByRole('button', { name: 'Criar grupo' }))
    expect(
      await screen.findByText('O nome deve ter no máximo 50 caracteres.')
    ).toBeInTheDocument()
    expect(mocks.create).not.toHaveBeenCalled()

    fireEvent.change(field, { target: { value: 'x'.repeat(50) } })
    await user.click(screen.getByRole('button', { name: 'Criar grupo' }))
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(workspaceId, 'x'.repeat(50))
    )

    fireEvent.change(field, { target: { value: '  Novo nome  ' } })
    mocks.create.mockRejectedValueOnce(new ApiError('conflict', 409))
    await user.click(screen.getByRole('button', { name: 'Criar grupo' }))
    await waitFor(() =>
      expect(mocks.create).toHaveBeenLastCalledWith(workspaceId, 'Novo nome')
    )
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Já existe um grupo com esse nome.'
      )
    )
  })

  it('renames with a trimmed name and leaves the existing group members intact', async () => {
    const user = userEvent.setup()
    await renderGroups()
    await user.click(
      await screen.findByRole('button', { name: 'Renomear Equipe' })
    )
    const field = screen.getByRole('textbox', { name: 'Nome do grupo' })
    fireEvent.change(field, { target: { value: '  Equipe nova  ' } })
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(mocks.rename).toHaveBeenCalledWith(
        workspaceId,
        group.id,
        'Equipe nova'
      )
    )
    expect(await screen.findByText('Ana Owner')).toBeInTheDocument()
    expect(mocks.listGroupMembers).toHaveBeenCalledWith(workspaceId, group.id)
  })

  it('confirms deletion, sends no cascading calls on 409 and shows the dependency message', async () => {
    const user = userEvent.setup()
    mocks.delete.mockRejectedValueOnce(new ApiError('linked resources', 409))
    await renderGroups()
    await user.click(
      await screen.findByRole('button', { name: 'Excluir Equipe' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(
      'só pode ser excluído quando não tiver integrantes nem recursos vinculados'
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Excluir grupo' })
    )
    await waitFor(() =>
      expect(mocks.delete).toHaveBeenCalledWith(workspaceId, group.id)
    )
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Remova os integrantes e vínculos do grupo antes de excluí-lo.'
      )
    )
    expect(mocks.removeMember).not.toHaveBeenCalled()
    expect(mocks.listGroupMembers).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('returns focus to the group delete button when the dialog is dismissed', async () => {
    const user = userEvent.setup()
    await renderGroups()
    const opener = await screen.findByRole('button', { name: 'Excluir Equipe' })

    await user.click(opener)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(opener).toHaveFocus())

    await user.click(opener)
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('moves focus to the page heading after deleting a group', async () => {
    const user = userEvent.setup()
    await renderGroups()
    await user.click(
      await screen.findByRole('button', { name: 'Excluir Equipe' })
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Excluir grupo' })
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(
      screen.getByRole('heading', { name: 'Grupos de acesso' })
    ).toHaveFocus()
  })

  it('filters candidates by workspace membership ID, adds and removes using that ID, and prevents duplicate pending actions', async () => {
    const user = userEvent.setup()
    mocks.listGroupMembers.mockResolvedValue({ data: [groupMember] })
    mocks.listWorkspaceMembers.mockResolvedValue({
      data: [
        candidate,
        { ...candidate, id: 'membership-1', name: 'Ana Owner' },
      ],
    })
    let resolveAdd: () => void = () => undefined
    mocks.addMember.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveAdd = resolve
      })
    )
    await renderGroups()

    expect(await screen.findByText('Ana Owner')).toBeInTheDocument()
    const select = screen.getByRole('combobox', {
      name: 'Adicionar integrante',
    })
    await user.click(select)
    expect(screen.queryByRole('option', { name: anaOptionPattern })).toBeNull()
    await user.click(screen.getByRole('option', { name: biaOptionPattern }))
    const add = screen.getByRole('button', { name: 'Adicionar' })
    await user.click(add)
    await waitFor(() =>
      expect(mocks.addMember).toHaveBeenCalledWith(
        workspaceId,
        group.id,
        'membership-2'
      )
    )
    expect(add).toBeDisabled()
    fireEvent.click(add)
    expect(mocks.addMember).toHaveBeenCalledTimes(1)
    resolveAdd()
    await waitFor(() => expect(mocks.listGroupMembers).toHaveBeenCalledTimes(2))

    let resolveRemove: () => void = () => undefined
    mocks.removeMember.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRemove = resolve
      })
    )
    const remove = screen.getByRole('button', {
      name: 'Remover Ana Owner do grupo',
    })
    await user.click(remove)
    await waitFor(() =>
      expect(mocks.removeMember).toHaveBeenCalledWith(
        workspaceId,
        group.id,
        'membership-1'
      )
    )
    fireEvent.click(remove)
    expect(mocks.removeMember).toHaveBeenCalledTimes(1)
    resolveRemove()
    await waitFor(() => expect(mocks.listGroupMembers).toHaveBeenCalledTimes(3))
  })

  it.each([403, 404, 409])(
    'shows safe membership action feedback for HTTP %i and allows retry',
    async (status) => {
      const user = userEvent.setup()
      mocks.listGroupMembers.mockResolvedValue({ data: [] })
      mocks.addMember.mockRejectedValueOnce(
        new ApiError('private server detail', status)
      )
      await renderGroups()
      const select = await screen.findByRole('combobox', {
        name: 'Adicionar integrante',
      })
      await user.click(select)
      await user.click(screen.getByRole('option', { name: biaOptionPattern }))
      await user.click(screen.getByRole('button', { name: 'Adicionar' }))
      const message =
        status === 403
          ? 'Você não tem permissão para gerenciar grupos.'
          : status === 404
            ? 'O workspace, grupo ou integrante não foi encontrado.'
            : 'O vínculo do integrante com este grupo mudou. Atualize a lista e tente novamente.'
      await waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith(message)
      )
      expect(mocks.toastError).not.toHaveBeenCalledWith('private server detail')
    }
  )
})
