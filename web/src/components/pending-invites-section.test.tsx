// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inviteApi } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import type { InviteResponse } from '@/api/types'
import '../test/dom-setup'
import { PendingInvitesSection } from './pending-invites-section'

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    inviteApi: {
      ...actual.inviteApi,
      list: vi.fn(),
      revoke: vi.fn(),
    },
  }
})

const sampleInvite: InviteResponse = {
  createdAt: '2026-10-20T12:00:00Z',
  email: 'colaborador@example.com',
  expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  id: 'invite-1',
  invitedByName: 'Ana Silva',
  invitedByUserId: 'user-1',
}

const createdAtPattern = /Criado em/
const expiresAtPattern = /Expira em/
const rolePattern = /cargo|role/i
const confirmationPattern = /Tem certeza/
const expiredDescriptionPattern = /expirou e não pode mais ser revogado/

function setup(initialInvites?: InviteResponse[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: 0 },
    },
  })
  if (initialInvites) queryClient.setQueryData(['invites'], initialInvites)
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const user = userEvent.setup({
    ...(vi.isFakeTimers() ? { advanceTimers: vi.advanceTimersByTime } : {}),
    pointerEventsCheck: PointerEventsCheckLevel.Never,
  })
  const view = render(<PendingInvitesSection />, { wrapper })
  return { queryClient, user, ...view }
}

function deferred<T>() {
  let rejectPromise: (reason?: unknown) => void = () => undefined
  let resolvePromise: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve, reject) => {
    rejectPromise = reject
    resolvePromise = resolve
  })
  return { promise, reject: rejectPromise, resolve: resolvePromise }
}

beforeEach(() => {
  vi.mocked(inviteApi.list).mockReset()
  vi.mocked(inviteApi.revoke).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('PendingInvitesSection', () => {
  it('shows loading, then invite details without a role field', async () => {
    const request = deferred<{ data: InviteResponse[] }>()
    vi.mocked(inviteApi.list).mockReturnValue(request.promise as never)
    setup()

    expect(screen.getByText('Carregando convites…')).toBeInTheDocument()
    await act(async () => request.resolve({ data: [sampleInvite] }))

    expect(
      await screen.findByText('colaborador@example.com')
    ).toBeInTheDocument()
    expect(screen.getByText('Convidado por Ana Silva')).toBeInTheDocument()
    expect(screen.getByText(createdAtPattern)).toBeInTheDocument()
    expect(screen.getByText(expiresAtPattern)).toBeInTheDocument()
    expect(screen.queryByText(rolePattern)).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no pending invites', async () => {
    vi.mocked(inviteApi.list).mockResolvedValue({ data: [] } as never)
    setup()

    expect(
      await screen.findByText('Nenhum convite pendente')
    ).toBeInTheDocument()
  })

  it('offers retry after a load error', async () => {
    vi.mocked(inviteApi.list)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: [sampleInvite] } as never)
    const { user } = setup()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os convites pendentes.'
    )
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(
      await screen.findByText('colaborador@example.com')
    ).toBeInTheDocument()
  })

  it('requires confirmation and does not call the API when cancelled', async () => {
    vi.mocked(inviteApi.list).mockResolvedValue({
      data: [sampleInvite],
    } as never)
    const { user } = setup()
    await screen.findByText('colaborador@example.com')

    await user.click(
      screen.getByRole('button', {
        name: 'Revogar convite para colaborador@example.com',
      })
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(confirmationPattern)).toBeInTheDocument()
    expect(inviteApi.revoke).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(inviteApi.revoke).not.toHaveBeenCalled()
  })

  it('removes optimistically, confirms on success, and refreshes the invite cache', async () => {
    const request = deferred<void>()
    vi.mocked(inviteApi.list)
      .mockResolvedValueOnce({ data: [sampleInvite] } as never)
      .mockResolvedValueOnce({ data: [] } as never)
    vi.mocked(inviteApi.revoke).mockReturnValue(request.promise as never)
    const { user } = setup()
    await screen.findByText('colaborador@example.com')
    await user.click(
      screen.getByRole('button', {
        name: 'Revogar convite para colaborador@example.com',
      })
    )
    const dialog = await screen.findByRole('dialog')

    await user.click(
      within(dialog).getByRole('button', { name: 'Revogar convite' })
    )
    expect(screen.getByText('Nenhum convite pendente')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' })
    ).toBeDisabled()
    expect(
      within(dialog).getByRole('button', { name: 'Revogando…' })
    ).toBeDisabled()

    await act(async () => request.resolve())
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(vi.mocked(inviteApi.revoke).mock.calls[0]?.[0]).toBe('invite-1')
    expect(inviteApi.list).toHaveBeenCalledTimes(2)
  })

  it('restores the invite and keeps the confirmation open after a revoke error', async () => {
    vi.mocked(inviteApi.list).mockResolvedValue({
      data: [sampleInvite],
    } as never)
    vi.mocked(inviteApi.revoke).mockRejectedValue(
      new ApiError('offline', undefined, undefined, undefined, {
        networkError: true,
      })
    )
    const { user } = setup()
    await screen.findByText('colaborador@example.com')
    await user.click(
      screen.getByRole('button', {
        name: 'Revogar convite para colaborador@example.com',
      })
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Revogar convite' })
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Erro de conexão. Verifique sua internet e tente novamente.'
    )
    expect(screen.getByText('colaborador@example.com')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Revogar convite' })
    ).toBeEnabled()
    expect(inviteApi.revoke).toHaveBeenCalledTimes(1)
  })

  it('marks an invite expired and disables revocation at its expiration time', async () => {
    const expiresAt = new Date(Date.now() - 1).toISOString()
    const invite = { ...sampleInvite, expiresAt }
    vi.mocked(inviteApi.list).mockResolvedValue({ data: [invite] } as never)
    setup([invite])
    expect(await screen.findByText('Convite expirado')).toBeInTheDocument()

    const revokeButton = screen.getByRole('button', {
      name: 'Revogar convite para colaborador@example.com',
    })
    expect(revokeButton).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(inviteApi.revoke).not.toHaveBeenCalled()
  })

  it('blocks a confirmation that expires while the dialog is open', async () => {
    const expiresAt = new Date(Date.now() + 1500).toISOString()
    const invite = { ...sampleInvite, expiresAt }
    vi.mocked(inviteApi.list).mockResolvedValue({ data: [invite] } as never)
    const { user } = setup([invite])
    expect(screen.getByText('colaborador@example.com')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: 'Revogar convite para colaborador@example.com',
      })
    )
    const dialog = screen.getByRole('dialog')

    await within(dialog).findByText(expiredDescriptionPattern, undefined, {
      timeout: 2500,
    })
    expect(
      within(dialog).getByText(expiredDescriptionPattern)
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Revogar convite' })
    ).toBeDisabled()
    expect(inviteApi.revoke).not.toHaveBeenCalled()
  })
})
