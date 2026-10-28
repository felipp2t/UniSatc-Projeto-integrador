// @vitest-environment happy-dom

import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { renderWithProviders } from '@/test/render'

const { create, success } = vi.hoisted(() => ({
  create: vi.fn(),
  success: vi.fn(),
}))

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return { ...actual, inviteApi: { ...actual.inviteApi, create } }
})

vi.mock('@/components/ui/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/toast')>()
  return { ...actual, appToast: { ...actual.appToast, success } }
})

import { InviteMemberDialog } from './invite-member-dialog'

function setup() {
  const user = userEvent.setup()
  const rendered = renderWithProviders(<InviteMemberDialog />)
  return { ...rendered, user }
}

beforeEach(() => {
  create.mockReset()
  success.mockReset()
})

describe('InviteMemberDialog', () => {
  it('validates empty and malformed addresses without sending a request', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Convidar' }))
    const dialog = screen.getByRole('dialog')
    const email = within(dialog).getByLabelText('E-mail')

    await user.click(
      within(dialog).getByRole('button', { name: 'Criar convite' })
    )
    expect(
      await within(dialog).findByText('Informe um e-mail válido.')
    ).toBeTruthy()
    await user.type(email, 'not-an-email')
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar convite' })
    )
    expect(
      await within(dialog).findByText('Informe um e-mail válido.')
    ).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })

  it('sends only the trimmed email, invalidates invite queries, announces success and resets', async () => {
    const { queryClient, user } = setup()
    create.mockResolvedValue(undefined)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    await user.click(screen.getByRole('button', { name: 'Convidar' }))
    const dialog = screen.getByRole('dialog')
    await user.type(
      within(dialog).getByLabelText('E-mail'),
      '  member@example.com  '
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar convite' })
    )

    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    expect(create.mock.calls[0]?.[0]).toEqual({ email: 'member@example.com' })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['invites'] })
    expect(success).toHaveBeenCalledWith(
      'Convite criado; e-mail encaminhado para envio'
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Convidar' }))
    expect(
      within(screen.getByRole('dialog')).getByLabelText('E-mail')
    ).toHaveValue('')
  })

  it.each([
    [409, {}, 'Este e-mail já possui uma conta.'],
    [403, {}, 'Apenas o dono do workspace pode executar esta ação.'],
    [
      undefined,
      { networkError: true },
      'Erro de conexão. Verifique sua internet e tente novamente.',
    ],
    [500, {}, 'Não foi possível criar o convite. Tente novamente.'],
  ])(
    'shows the appropriate error for status %s and allows retry',
    async (status, options, message) => {
      const { user } = setup()
      create.mockRejectedValueOnce(
        new ApiError('failure', status, undefined, undefined, options)
      )
      await user.click(screen.getByRole('button', { name: 'Convidar' }))
      const dialog = screen.getByRole('dialog')
      await user.type(
        within(dialog).getByLabelText('E-mail'),
        'member@example.com'
      )
      await user.click(
        within(dialog).getByRole('button', { name: 'Criar convite' })
      )
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        message
      )
      expect(within(dialog).getByLabelText('E-mail')).toHaveValue(
        'member@example.com'
      )
    }
  )

  it('prevents duplicate submissions while the request is pending and describes resend expiry', async () => {
    let resolveRequest: () => void = () => undefined
    create.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRequest = resolve
      })
    )
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Convidar' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(
        'O convite não define o papel. Se já houver um convite pendente para este e-mail, ele será substituído, o link anterior será invalidado e o prazo de sete dias começará novamente.'
      )
    ).toBeTruthy()
    await user.type(
      within(dialog).getByLabelText('E-mail'),
      'member@example.com'
    )
    const submit = within(dialog).getByRole('button', { name: 'Criar convite' })
    await user.click(submit)
    expect(submit).toBeDisabled()
    await user.click(submit)
    expect(create).toHaveBeenCalledOnce()
    await act(async () => resolveRequest())
  })
})
