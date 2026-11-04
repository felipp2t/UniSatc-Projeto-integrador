// @vitest-environment happy-dom

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { renderWithProviders } from '@/test/render'

const { invite, success } = vi.hoisted(() => ({
  invite: vi.fn(),
  success: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return { ...actual, adminApi: { ...actual.adminApi, invite } }
})

vi.mock('@/components/ui/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/toast')>()
  return { ...actual, appToast: { ...actual.appToast, success } }
})

import { AdminInviteDialog } from './admin-invite-dialog'

async function openDialog() {
  const user = userEvent.setup()
  renderWithProviders(
    <AdminInviteDialog workspaceId='workspace-1' workspaceName='Financeiro' />
  )
  await user.click(
    screen.getByRole('button', { name: 'Convidar para Financeiro' })
  )
  return { dialog: screen.getByRole('dialog'), user }
}

beforeEach(() => {
  invite.mockReset()
  success.mockReset()
})

describe('AdminInviteDialog', () => {
  it('invites as a regular member by default', async () => {
    invite.mockResolvedValue(undefined)
    const { dialog, user } = await openDialog()

    await user.type(
      within(dialog).getByLabelText('E-mail'),
      ' membro@example.com '
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar convite' })
    )

    await waitFor(() =>
      expect(invite).toHaveBeenCalledWith('workspace-1', {
        email: 'membro@example.com',
        owner: false,
      })
    )
    expect(success).toHaveBeenCalled()
  })

  it('invites as owner when the checkbox is selected', async () => {
    invite.mockResolvedValue(undefined)
    const { dialog, user } = await openDialog()

    await user.type(
      within(dialog).getByLabelText('E-mail'),
      'lider@example.com'
    )
    await user.click(
      within(dialog).getByLabelText(
        'Entrar como proprietário (líder da equipe)'
      )
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar convite' })
    )

    await waitFor(() =>
      expect(invite).toHaveBeenCalledWith('workspace-1', {
        email: 'lider@example.com',
        owner: true,
      })
    )
  })

  it('announces when an existing account joins directly', async () => {
    invite.mockResolvedValue({ data: { addedExistingAccount: true } })
    const { dialog, user } = await openDialog()

    await user.type(
      within(dialog).getByLabelText('E-mail'),
      'removida@example.com'
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar convite' })
    )

    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        'Conta existente adicionada ao workspace'
      )
    )
  })

  it('explains when the account already belongs to a workspace', async () => {
    invite.mockRejectedValue(new ApiError('Conflito', 409))
    const { dialog, user } = await openDialog()

    await user.type(
      within(dialog).getByLabelText('E-mail'),
      'existe@example.com'
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar convite' })
    )

    expect(
      await within(dialog).findByText('Esta conta já pertence a um workspace.')
    ).toBeTruthy()
  })
})
