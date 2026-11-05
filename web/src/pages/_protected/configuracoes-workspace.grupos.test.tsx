// @vitest-environment happy-dom

import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  members,
  ownerId,
  renderWorkspaceSettings,
  setupWorkspaceSettingsMocks,
  workspaceId,
} from '@/test/workspace-settings-fixtures'

const mocks = vi.hoisted(() => ({
  addMember: vi.fn(),
  collections: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  listMembers: vi.fn(),
  permissions: vi.fn(),
  removeMember: vi.fn(),
  rename: vi.fn(),
  transferLeader: vi.fn(),
  workspaceList: vi.fn(),
  workspaceMembers: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    collectionsApi: { ...actual.collectionsApi, list: mocks.collections },
    workspaceApi: {
      ...actual.workspaceApi,
      list: mocks.workspaceList,
      listMembers: mocks.workspaceMembers,
      permissions: mocks.permissions,
    },
    workspaceTeamsApi: {
      ...actual.workspaceTeamsApi,
      addMember: mocks.addMember,
      create: mocks.create,
      delete: mocks.delete,
      list: mocks.list,
      listMembers: mocks.listMembers,
      removeMember: mocks.removeMember,
      rename: mocks.rename,
      transferLeader: mocks.transferLeader,
    },
  }
})

const teamsPath = '/configuracoes/grupo'
const teamId = '00000000-0000-4000-8000-000000000001'
const collectionId = '00000000-0000-4000-8000-000000000002'
const anotherCollectionId = '00000000-0000-4000-8000-000000000003'
const team = {
  id: teamId,
  leaderMemberId: 'membership-2',
  leaderName: 'Bia Member',
  memberCount: 2,
  name: 'Equipe',
  rootCollectionId: collectionId,
  rootCollectionName: 'Equipe',
}
const member = {
  ...members[1],
  teamId: null,
}
const caio = {
  email: 'caio@example.com',
  globalRole: null,
  id: 'membership-3',
  isTeamLeader: false,
  name: 'Caio Member',
  roleName: 'Member',
  teamId,
  userId: 'member-3',
}
const teamMembers = [
  {
    id: 'membership-2',
    name: 'Bia Member',
    roleName: 'Leader',
    userId: 'member-2',
  },
]
const moveTeamMemberName = /Caio Member · mover de outro time/
const collectionPage = {
  data: {
    items: [
      { id: collectionId, name: 'Equipe', parentId: null },
      { id: anotherCollectionId, name: 'Sem time', parentId: null },
      { id: 'nested-1', name: 'Aninhada', parentId: collectionId },
    ],
    totalPages: 1,
  },
}

beforeEach(() => {
  setupWorkspaceSettingsMocks()
  mocks.workspaceList.mockResolvedValue({
    data: [{ id: workspaceId, name: 'Workspace', ownerId }],
  })
  mocks.workspaceMembers.mockResolvedValue({ data: [members[0], member, caio] })
  mocks.permissions.mockResolvedValue({
    data: {
      globalRole: null,
      isOwner: true,
      isTeamLeader: false,
      permissions: [],
      roleName: 'Owner',
      teamId: null,
    },
  })
  mocks.collections.mockResolvedValue(collectionPage)
  mocks.list.mockResolvedValue({ data: [team] })
  mocks.listMembers.mockResolvedValue({ data: teamMembers })
  mocks.create.mockResolvedValue({
    data: {
      ...team,
      id: '00000000-0000-4000-8000-000000000004',
      name: 'Novo time',
    },
  })
  mocks.rename.mockResolvedValue(undefined)
  mocks.delete.mockResolvedValue(undefined)
  mocks.addMember.mockResolvedValue(undefined)
  mocks.removeMember.mockResolvedValue(undefined)
  mocks.transferLeader.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderTeams(userId = ownerId) {
  return renderWorkspaceSettings(userId, teamsPath)
}

describe('workspace teams settings', () => {
  it('creates a team with a required leader and ignores the workspace owner as a candidate', async () => {
    const user = userEvent.setup()
    await renderTeams()

    expect(
      await screen.findByRole('heading', { name: 'Equipe' })
    ).toBeInTheDocument()
    await user.click(screen.getByLabelText('Líder inicial'))
    expect(screen.queryByRole('option', { name: 'Ana Owner' })).toBeNull()
    await user.click(screen.getByRole('option', { name: 'Bia Member' }))
    await user.type(
      screen.getByLabelText('Nome do time', { selector: '#new-team-name' }),
      '  Novo time  '
    )
    await user.click(screen.getByLabelText('Coleção raiz'))
    expect(screen.queryByRole('option', { name: 'Equipe' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Aninhada' })).toBeNull()
    await user.click(screen.getByRole('option', { name: 'Sem time' }))
    await user.click(screen.getByRole('button', { name: 'Criar time' }))

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(workspaceId, {
        leaderMemberId: 'membership-2',
        name: 'Novo time',
        rootCollectionId: anotherCollectionId,
      })
    )
  })

  it('requires name and leader before submitting and uses automatic collection when selected', async () => {
    const user = userEvent.setup()
    await renderTeams()
    expect(
      await screen.findByRole('button', { name: 'Criar time' })
    ).toBeDisabled()
    const name = screen.getByLabelText('Nome do time', {
      selector: '#new-team-name',
    })
    await user.type(name, ' Time automático ')
    expect(screen.getByRole('button', { name: 'Criar time' })).toBeDisabled()
    await user.click(screen.getByLabelText('Líder inicial'))
    await user.click(screen.getByRole('option', { name: 'Bia Member' }))
    await user.click(screen.getByRole('button', { name: 'Criar time' }))
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(workspaceId, {
        leaderMemberId: 'membership-2',
        name: 'Time automático',
        rootCollectionId: undefined,
      })
    )
  })

  it('supports team rename and asks confirmation before deleting while preserving its collection', async () => {
    const user = userEvent.setup()
    await renderTeams()
    await screen.findByText('Coleção: Equipe')
    await user.clear(
      screen.getByLabelText('Nome do time', { selector: '#rename-team' })
    )
    await user.type(
      screen.getByLabelText('Nome do time', { selector: '#rename-team' }),
      'Equipe renomeada'
    )
    await user.click(screen.getByRole('button', { name: 'Renomear' }))
    await waitFor(() =>
      expect(mocks.rename).toHaveBeenCalledWith(
        workspaceId,
        teamId,
        'Equipe renomeada'
      )
    )

    await user.click(screen.getByRole('button', { name: 'Excluir time' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('preserva a coleção do time')
    expect(mocks.delete).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(mocks.delete).toHaveBeenCalledWith(workspaceId, teamId)
    )
  })

  it('adds or moves a member, confirms removal, and transfers team leadership', async () => {
    const user = userEvent.setup()
    mocks.workspaceMembers.mockResolvedValue({
      data: [
        members[0],
        { ...member, teamId: null },
        {
          email: 'caio@example.com',
          globalRole: null,
          id: 'membership-3',
          isTeamLeader: false,
          name: 'Caio Member',
          roleName: 'Member',
          teamId: '00000000-0000-4000-8000-000000000009',
          userId: 'member-3',
        },
      ],
    })
    mocks.listMembers
      .mockResolvedValueOnce({ data: teamMembers })
      .mockResolvedValue({
        data: [
          ...teamMembers,
          {
            id: 'membership-3',
            name: 'Caio Member',
            roleName: 'Member',
            userId: 'member-3',
          },
        ],
      })
    await renderTeams()

    await user.click(
      await screen.findByRole('combobox', {
        name: 'Adicionar ou mover integrante',
      })
    )
    expect(screen.queryByRole('option', { name: 'Ana Owner' })).toBeNull()
    await user.click(screen.getByRole('option', { name: moveTeamMemberName }))
    await user.click(
      screen.getByRole('button', { name: 'Adicionar ou mover integrante' })
    )
    await waitFor(() =>
      expect(mocks.addMember).toHaveBeenCalledWith(
        workspaceId,
        teamId,
        'membership-3'
      )
    )

    await user.click(
      screen.getByRole('button', { name: 'Remover Caio Member do time Equipe' })
    )
    let dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('continuará no workspace')
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(mocks.removeMember).toHaveBeenCalledWith(
        workspaceId,
        teamId,
        'membership-3'
      )
    )

    await user.click(
      screen.getByRole('button', { name: 'Tornar Caio Member líder de Equipe' })
    )
    dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('passará a liderar Equipe')
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(mocks.transferLeader).toHaveBeenCalledWith(
        workspaceId,
        teamId,
        'membership-3'
      )
    )
  })

  it('limits team management to leaders and hides owner/admin-wide controls', async () => {
    mocks.permissions.mockResolvedValue({
      data: {
        globalRole: null,
        isOwner: false,
        isTeamLeader: true,
        permissions: [{ action: 'manage', resource: 'team' }],
        roleName: 'Leader',
        teamId,
      },
    })
    mocks.workspaceMembers.mockResolvedValue({
      data: [
        { ...member, isTeamLeader: true, teamId },
        {
          email: 'caio@example.com',
          globalRole: null,
          id: 'membership-3',
          isTeamLeader: false,
          name: 'Caio Member',
          roleName: 'Member',
          teamId: null,
          userId: 'member-3',
        },
      ],
    })
    await renderTeams('member-2')
    expect(
      await screen.findByRole('heading', { name: 'Equipe' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir time' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Renomear' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Adicionar ou mover integrante' })
    ).toBeInTheDocument()
  })

  it('does not load or expose team management to a member without team permission', async () => {
    mocks.permissions.mockResolvedValue({
      data: {
        globalRole: null,
        isOwner: false,
        isTeamLeader: false,
        permissions: [],
        roleName: 'Member',
        teamId: null,
      },
    })
    await renderTeams('member-2')
    expect(
      await screen.findByText('Você não tem permissão para gerenciar times.')
    ).toBeInTheDocument()
    expect(mocks.list).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Criar time' })).toBeNull()
  })

  it('keeps the loading state and shows a recoverable teams error', async () => {
    let resolveTeams: (value: { data: (typeof team)[] }) => void = () =>
      undefined
    mocks.list.mockReturnValue(
      new Promise((resolve) => {
        resolveTeams = resolve
      })
    )
    await renderTeams()
    expect(await screen.findByText('Carregando times…')).toBeInTheDocument()
    resolveTeams({ data: [team] })
    expect(
      await screen.findByRole('heading', { name: 'Equipe' })
    ).toBeInTheDocument()

    mocks.list.mockRejectedValueOnce(new Error('private network detail'))
    await renderTeams()
    expect(
      await screen.findByText('Não foi possível carregar os times.')
    ).toBeInTheDocument()
    expect(screen.queryByText('private network detail')).toBeNull()
  })
})
