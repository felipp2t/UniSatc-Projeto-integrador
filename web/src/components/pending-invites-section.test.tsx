// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inviteApi } from '@/api/endpoints'
import { ApiError } from '@/api/errors'
import { inviteQueryKey } from '@/api/invites'
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

const invite: InviteResponse = {
  createdAt: '2026-10-20T12:00:00Z',
  email: 'colaborador@example.com',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  })
  if (initialInvites) queryClient.setQueryData(inviteQueryKey, initialInvites)
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const user = userEvent.setup(
    vi.isFakeTimers() ? { advanceTimers: vi.advanceTimersByTime } : {}
  )
  return {
    queryClient,
    user,
    ...render(<PendingInvitesSection />, { wrapper }),
  }
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
  it('shows invite email, inviter, creation and expiry metadata without a role', async () => {
    vi.mocked(inviteApi.list).mockResolvedValue({ data: [invite] } as never)
    setup()

    expect(
      await screen.findByText('colaborador@example.com')
    ).toBeInTheDocument()
    expect(screen.getByText('Convidado por Ana Silva')).toBeInTheDocument()
    expect(screen.getByText(createdAtPattern)).toBeInTheDocument()
    expect(screen.getByText(expiresAtPattern)).toBeInTheDocument()
    expect(screen.queryByText(rolePattern)).not.toBeInTheDocument()
  })

  it('shows an empty state and retries after a list error', async () => {
    vi.mocked(inviteApi.list)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: [] } as never)
    const { user } = setup()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os convites pendentes.'
    )
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(
      await screen.findByText('Nenhum convite pendente')
    ).toBeInTheDocument()
  })

  it('requires confirmation and does not call the API when cancelled', async () => {
    vi.mocked(inviteApi.list).mockResolvedValue({ data: [invite] } as never)
    const { user } = setup()
    await screen.findByText('colaborador@example.com')

    await user.click(
      screen.getByRole('button', {
        name: 'Revogar convite para colaborador@example.com',
      })
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(confirmationPattern)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(inviteApi.revoke).not.toHaveBeenCalled()
  })

  it('removes optimistically, refreshes after success, and closes confirmation', async () => {
    let finishRevoke: () => void = () => undefined
    vi.mocked(inviteApi.list)
      .mockResolvedValueOnce({ data: [invite] } as never)
      .mockResolvedValueOnce({ data: [] } as never)
    vi.mocked(inviteApi.revoke).mockReturnValue(
      new Promise<void>((resolve) => {
        finishRevoke = resolve
      }) as never
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

    expect(screen.getByText('Nenhum convite pendente')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Revogando…' })
    ).toBeDisabled()
    await act(async () => finishRevoke())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(inviteApi.list).toHaveBeenCalledTimes(2)
  })

  it('keeps revoke error and retry available when rollback refetch also fails', async () => {
    vi.mocked(inviteApi.list)
      .mockResolvedValueOnce({ data: [invite] } as never)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: [] } as never)
    vi.mocked(inviteApi.revoke)
      .mockRejectedValueOnce(
        new ApiError('offline', undefined, undefined, undefined, {
          networkError: true,
        })
      )
      .mockResolvedValueOnce(undefined as never)
    const { user } = setup()
    await screen.findByText('colaborador@example.com')
    await user.click(
      screen.getByRole('button', {
        name: 'Revogar convite para colaborador@example.com',
      })
    )
    let dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Revogar convite' })
    )

    expect(
      await screen.findByText(
        'Não foi possível carregar os convites pendentes.'
      )
    ).toBeInTheDocument()
    dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Erro de conexão. Verifique sua internet e tente novamente.'
    )
    expect(
      within(dialog).getByRole('button', { name: 'Revogar convite' })
    ).toBeEnabled()

    await user.click(
      within(dialog).getByRole('button', { name: 'Revogar convite' })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(inviteApi.revoke).toHaveBeenCalledTimes(2)
    expect(
      await screen.findByText('Nenhum convite pendente')
    ).toBeInTheDocument()
  })

  it.each([
    [
      new ApiError('forbidden', 403),
      'Você não tem permissão para revogar este convite.',
    ],
    [
      new ApiError('not found', 404),
      'Este convite não está mais disponível. Atualize a lista e tente novamente.',
    ],
    [
      new ApiError('offline', undefined, undefined, undefined, {
        networkError: true,
      }),
      'Erro de conexão. Verifique sua internet e tente novamente.',
    ],
  ])(
    'maps revoke failures to a user-facing message',
    async (error, message) => {
      vi.mocked(inviteApi.list).mockResolvedValue({ data: [invite] } as never)
      vi.mocked(inviteApi.revoke).mockRejectedValueOnce(error)
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
        message
      )
    }
  )

  it('marks an expired invite and prevents opening a revoke dialog', async () => {
    const expired = {
      ...invite,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    }
    vi.mocked(inviteApi.list).mockResolvedValue({ data: [expired] } as never)
    setup()

    expect(await screen.findByText('Convite expirado')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Revogar convite para colaborador@example.com',
      })
    ).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('blocks confirmation when an invite expires while its dialog is open', async () => {
    vi.useFakeTimers()
    const expiring = {
      ...invite,
      expiresAt: new Date(Date.now() + 1500).toISOString(),
    }
    vi.mocked(inviteApi.list).mockResolvedValue({ data: [expiring] } as never)
    setup([expiring])
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Revogar convite para colaborador@example.com',
      })
    )
    const dialog = screen.getByRole('dialog')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })

    expect(
      within(dialog).getByText(expiredDescriptionPattern)
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Revogar convite' })
    ).toBeDisabled()
    expect(inviteApi.revoke).not.toHaveBeenCalled()
  })

  it('keeps the selected invite expiry active after optimistic removal from the list', async () => {
    vi.useFakeTimers()
    const expiring = {
      ...invite,
      expiresAt: new Date(Date.now() + 1500).toISOString(),
    }
    let finishRevoke: () => void = () => undefined
    vi.mocked(inviteApi.list).mockResolvedValue({ data: [expiring] } as never)
    vi.mocked(inviteApi.revoke).mockReturnValue(
      new Promise<void>((resolve) => {
        finishRevoke = resolve
      }) as never
    )
    const { queryClient } = setup([expiring])
    expect(screen.getByText('colaborador@example.com')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Revogar convite para colaborador@example.com',
      })
    )
    const dialog = screen.getByRole('dialog')
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Revogar convite' })
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(queryClient.getQueryData(inviteQueryKey)).toEqual([])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600)
    })

    expect(
      within(dialog).getByText(expiredDescriptionPattern)
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Revogando…' })
    ).toBeDisabled()
    await act(async () => finishRevoke())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
