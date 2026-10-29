// @vitest-environment happy-dom

import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { createQueryClient } from '@/api/query-client'
import type { SessionService } from '@/auth/session'
import { renderWithProviders } from '@/test/render'
import { createSessionStub } from '@/test/session-stub'
import { routeTree } from '../route-tree.gen'

const { forgotPassword, login, resetPassword, successToast } = vi.hoisted(
  () => ({
    forgotPassword: vi.fn(),
    login: vi.fn(),
    resetPassword: vi.fn(),
    successToast: vi.fn(),
  })
)

const forgotPasswordErrorCases: [string, number | undefined, string][] = [
  ['HTTP 429', 429, 'Muitas tentativas. Aguarde um pouco e tente novamente.'],
  ['HTTP 400', 400, 'Confira o e-mail informado e tente novamente.'],
  [
    'HTTP 404 sem mensagem própria',
    404,
    'Não foi possível solicitar a redefinição. Tente novamente.',
  ],
  ...[500, 502, 503, 504].map((status): [string, number, string] => [
    `HTTP ${status}`,
    status,
    'Serviço temporariamente indisponível. Tente novamente em alguns instantes.',
  ]),
  [
    'sem conexão',
    undefined,
    'Erro de conexão. Verifique sua internet e tente novamente.',
  ],
]

const resetPasswordErrorCases: [string, number | undefined, string][] = [
  ['HTTP 429', 429, 'Muitas tentativas. Aguarde um pouco e tente novamente.'],
  ['HTTP 400', 400, 'Confira os dados informados e tente novamente.'],
  [
    'HTTP 404 sem mensagem própria',
    404,
    'Não foi possível redefinir a senha. Tente novamente.',
  ],
  ...[500, 502, 503, 504].map((status): [string, number, string] => [
    `HTTP ${status}`,
    status,
    'Serviço temporariamente indisponível. Tente novamente em alguns instantes.',
  ]),
  [
    'sem conexão',
    undefined,
    'Erro de conexão. Verifique sua internet e tente novamente.',
  ],
]

const loginErrorCases: [string, ApiError, string][] = [
  [
    'HTTP 400',
    new ApiError('DETALHE INTERNO', 400),
    'E-mail ou senha inválidos.',
  ],
  [
    'HTTP 401',
    new ApiError('DETALHE INTERNO', 401),
    'E-mail ou senha inválidos.',
  ],
  [
    'HTTP 429',
    new ApiError('DETALHE INTERNO', 429),
    'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
  ],
  [
    'erro de rede',
    new ApiError('DETALHE INTERNO', undefined, undefined, undefined, {
      networkError: true,
    }),
    'Erro de conexão. Verifique sua internet e tente novamente.',
  ],
  ...[500, 502, 503, 504].map((status): [string, ApiError, string] => [
    `HTTP ${status}`,
    new ApiError('DETALHE INTERNO', status),
    'Serviço temporariamente indisponível. Tente novamente em alguns instantes.',
  ]),
]

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>()
  return {
    ...actual,
    authApi: { ...actual.authApi, forgotPassword, login, resetPassword },
  }
})

vi.mock('@/components/ui/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/toast')>()
  return {
    ...actual,
    appToast: { ...actual.appToast, success: successToast },
  }
})

function createSession(): SessionService & {
  navigateToLogin: ReturnType<typeof vi.fn>
} {
  const navigateToLogin = vi.fn()
  return {
    ...createSessionStub({ handleSessionExpired: vi.fn(navigateToLogin) }),
    navigateToLogin,
  }
}

async function renderPage(entry: string) {
  const session = createSession()
  const queryClient = createQueryClient()
  const router = createRouter({
    context: {
      permissionChecker: { can: () => true },
      queryClient,
      session,
    },
    history: createMemoryHistory({ initialEntries: [entry] }),
    isServer: false,
    routeTree,
  })
  router.startTransition = (transition) => {
    transition()
    return Promise.resolve(true)
  }
  router.updateLatestLocation()
  await router.load({ sync: true })
  const rendered = renderWithProviders(<RouterProvider router={router} />, {
    queryClient,
  })
  return { ...rendered, router, session }
}

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('solicitação de recuperação de senha', () => {
  it.each(['conta@example.com', 'inexistente@example.com'])(
    'exibe a mesma mensagem genérica para %s',
    async (email) => {
      forgotPassword.mockResolvedValue(undefined)
      const user = userEvent.setup()
      await renderPage('/esqueci-senha')
      const status = screen.getByRole('status')
      expect(status).toBeEmptyDOMElement()

      await user.type(screen.getByLabelText('E-mail'), email)
      await user.click(
        screen.getByRole('button', { name: 'Enviar orientações' })
      )

      await waitFor(() =>
        expect(status).toHaveTextContent(
          'Se houver uma conta com esse e-mail, você receberá orientações para redefinir a senha.'
        )
      )
      expect(forgotPassword).toHaveBeenCalledWith({ email })
    }
  )

  it('disables the email field and removes the submit button after success', async () => {
    forgotPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    await renderPage('/esqueci-senha')

    await user.type(screen.getByLabelText('E-mail'), 'conta@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar orientações' }))

    await waitFor(() => expect(screen.getByLabelText('E-mail')).toBeDisabled())
    expect(
      screen.queryByRole('button', { name: 'Enviar orientações' })
    ).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not send an invalid email and offers the login link', async () => {
    const user = userEvent.setup()
    await renderPage('/esqueci-senha')

    await user.type(screen.getByLabelText('E-mail'), 'inválido')
    await user.click(screen.getByRole('button', { name: 'Enviar orientações' }))

    expect(await screen.findByText('Informe um e-mail válido.')).toBeTruthy()
    expect(forgotPassword).not.toHaveBeenCalled()
    expect(
      screen.getByRole('link', { name: 'Voltar ao login' })
    ).toHaveAttribute('href', '/login')
  })

  it('allows correcting an invalid email and submitting again', async () => {
    forgotPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    await renderPage('/esqueci-senha')
    const email = screen.getByLabelText('E-mail')

    await user.type(email, 'inválido')
    await user.click(screen.getByRole('button', { name: 'Enviar orientações' }))
    expect(await screen.findByText('Informe um e-mail válido.')).toBeTruthy()

    await user.clear(email)
    await user.type(email, 'conta@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar orientações' }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Se houver uma conta com esse e-mail, você receberá orientações para redefinir a senha.'
      )
    )
    expect(forgotPassword).toHaveBeenCalledOnce()
  })

  it('submits recovery instructions for a valid email', async () => {
    forgotPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    await renderPage('/esqueci-senha')

    await user.type(screen.getByLabelText('E-mail'), 'conta@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar orientações' }))

    await waitFor(() =>
      expect(forgotPassword).toHaveBeenCalledWith({
        email: 'conta@example.com',
      })
    )
  })

  it.each(forgotPasswordErrorCases)(
    'shows a recoverable message for %s',
    async (_caseName: string, status: number | undefined, message: string) => {
      forgotPassword.mockRejectedValue(
        status === undefined
          ? new ApiError('DETALHE INTERNO', undefined, undefined, undefined, {
              networkError: true,
            })
          : new ApiError('DETALHE INTERNO', status)
      )
      await renderPage('/esqueci-senha')

      fireEvent.change(screen.getByLabelText('E-mail'), {
        target: { value: 'conta@example.com' },
      })
      const user = userEvent.setup()
      await user.click(
        screen.getByRole('button', { name: 'Enviar orientações' })
      )

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(message)
      expect(alert).not.toHaveTextContent('DETALHE INTERNO')
      expect(forgotPassword).toHaveBeenCalledWith({
        email: 'conta@example.com',
      })
    }
  )
})

describe('redefinição de senha', () => {
  it.each([
    '/redefinir-senha',
    '/redefinir-senha?token=',
    '/redefinir-senha?token=%20%20%20',
  ])('offers a new request when token is missing in %s', async (entry) => {
    const { router } = await renderPage(entry)

    expect(
      await screen.findByRole('heading', { name: 'Link indisponível' })
    ).toBeTruthy()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Solicitar novo link' }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/esqueci-senha')
    )
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('offers a new request for an unavailable link returned as HTTP 401', async () => {
    resetPassword.mockRejectedValue(new ApiError('link indisponível', 401))
    const user = userEvent.setup()
    await renderPage('/redefinir-senha?token=token-atual')

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'senha forte' },
    })
    fireEvent.change(screen.getByLabelText('Confirme a senha'), {
      target: { value: 'senha forte' },
    })
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    expect(
      await screen.findByRole('heading', { name: 'Link indisponível' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Solicitar novo link' })
    ).toBeTruthy()
  })

  it('shows the form again with empty fields when the link changes after a rejection', async () => {
    resetPassword.mockRejectedValue(new ApiError('link indisponível', 401))
    const user = userEvent.setup()
    const { router } = await renderPage('/redefinir-senha?token=velho')

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'senha forte' },
    })
    fireEvent.change(screen.getByLabelText('Confirme a senha'), {
      target: { value: 'senha forte' },
    })
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))
    expect(
      await screen.findByRole('heading', { name: 'Link indisponível' })
    ).toBeTruthy()

    await router.navigate({
      search: { token: 'novo' },
      to: '/redefinir-senha',
    })

    expect(
      await screen.findByRole('heading', { name: 'Redefinir senha' })
    ).toBeTruthy()
    expect(screen.getByLabelText('Nova senha')).toHaveValue('')
    expect(screen.getByLabelText('Confirme a senha')).toHaveValue('')
    expect(
      screen.queryByRole('heading', { name: 'Link indisponível' })
    ).toBeNull()
    expect(resetPassword).toHaveBeenCalledOnce()
  })

  it('resets typed passwords and uses the new token when the link changes without a rejection', async () => {
    resetPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    const { router } = await renderPage('/redefinir-senha?token=antigo')

    await user.type(screen.getByLabelText('Nova senha'), 'senha digitada')
    await user.type(screen.getByLabelText('Confirme a senha'), 'senha digitada')
    await router.navigate({
      search: { token: 'novo' },
      to: '/redefinir-senha',
    })

    await waitFor(() =>
      expect(screen.getByLabelText('Nova senha')).toHaveValue('')
    )
    expect(screen.getByLabelText('Confirme a senha')).toHaveValue('')

    await user.type(screen.getByLabelText('Nova senha'), 'outra senha')
    await user.type(screen.getByLabelText('Confirme a senha'), 'outra senha')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({
        confirmPassword: 'outra senha',
        newPassword: 'outra senha',
        token: 'novo',
      })
    )
  })

  it('labels both password visibility buttons and follows the tab order', async () => {
    const user = userEvent.setup()
    await renderPage('/redefinir-senha?token=token-atual')

    expect(
      screen.getByRole('button', { name: 'Mostrar nova senha' })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Mostrar confirmação da senha' })
    ).toBeTruthy()

    await user.tab()
    expect(screen.getByLabelText('Nova senha')).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Mostrar nova senha' })
    ).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('Confirme a senha')).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Mostrar confirmação da senha' })
    ).toHaveFocus()
    await user.tab()
    expect(
      screen.getByRole('button', { name: 'Redefinir senha' })
    ).toHaveFocus()

    const newPassword = screen.getByLabelText('Nova senha')
    const confirmPassword = screen.getByLabelText('Confirme a senha')
    await user.click(screen.getByRole('button', { name: 'Mostrar nova senha' }))
    expect(newPassword).toHaveAttribute('type', 'text')
    expect(confirmPassword).toHaveAttribute('type', 'password')
    await user.click(
      screen.getByRole('button', { name: 'Mostrar confirmação da senha' })
    )
    expect(confirmPassword).toHaveAttribute('type', 'text')
  })

  it('validates minimum length and exact confirmation before sending', async () => {
    const user = userEvent.setup()
    await renderPage('/redefinir-senha?token=token-atual')

    await user.type(screen.getByLabelText('Nova senha'), 'curta')
    await user.type(screen.getByLabelText('Confirme a senha'), 'diferente')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    expect(await screen.findByText('Use pelo menos 8 caracteres.')).toBeTruthy()
    expect(screen.getByText('As senhas devem ser iguais.')).toBeTruthy()
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('rejects passwords made only of whitespace', async () => {
    const user = userEvent.setup()
    await renderPage('/redefinir-senha?token=token-atual')

    await user.type(screen.getByLabelText('Nova senha'), '        ')
    await user.type(screen.getByLabelText('Confirme a senha'), '        ')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    expect(
      await screen.findByText('A senha não pode conter apenas espaços.')
    ).toBeTruthy()
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('allows correcting invalid passwords and submitting again', async () => {
    resetPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    await renderPage('/redefinir-senha?token=token-atual')
    const newPassword = screen.getByLabelText('Nova senha')
    const confirmPassword = screen.getByLabelText('Confirme a senha')

    await user.type(newPassword, 'curta')
    await user.type(confirmPassword, 'diferente')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))
    expect(await screen.findByText('Use pelo menos 8 caracteres.')).toBeTruthy()

    await user.clear(newPassword)
    await user.clear(confirmPassword)
    await user.type(newPassword, 'senha forte')
    await user.type(confirmPassword, 'senha forte')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    await waitFor(() => expect(resetPassword).toHaveBeenCalledOnce())
    expect(resetPassword).toHaveBeenCalledWith({
      confirmPassword: 'senha forte',
      newPassword: 'senha forte',
      token: 'token-atual',
    })
  })

  it('preserves password characters and goes to login without a redirect after success', async () => {
    resetPassword.mockResolvedValue(undefined)
    const user = userEvent.setup()
    const { router, session } = await renderPage(
      '/redefinir-senha?token=token-atual'
    )
    let finishLogout: (() => void) | undefined
    vi.mocked(session.logout).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishLogout = () => {
            resolve()
          }
        })
    )
    const replace = vi.spyOn(router.history, 'replace')

    await user.type(screen.getByLabelText('Nova senha'), ' senha123 ')
    await user.type(screen.getByLabelText('Confirme a senha'), ' senha123 ')
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

    await waitFor(() => expect(resetPassword).toHaveBeenCalledOnce())
    expect(resetPassword).toHaveBeenCalledWith({
      confirmPassword: ' senha123 ',
      newPassword: ' senha123 ',
      token: 'token-atual',
    })
    await waitFor(() => expect(session.logout).toHaveBeenCalledOnce())
    expect(router.state.location.pathname).toBe('/redefinir-senha')
    finishLogout?.()
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toEqual({ redirect: undefined })
    expect(session.logout).toHaveBeenCalledOnce()
    expect(session.clearLocalSession).not.toHaveBeenCalled()
    expect(session.handleSessionExpired).not.toHaveBeenCalled()
    expect(session.navigateToLogin).not.toHaveBeenCalled()
    expect(session.initialize).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledOnce()
    expect(successToast).toHaveBeenCalledWith(
      'Senha redefinida. Entre novamente com sua nova senha.'
    )
  })

  it.each([
    [
      'a network error',
      new ApiError('offline', undefined, undefined, undefined, {
        networkError: true,
      }),
    ],
    ['HTTP 503', new ApiError('indisponível', 503)],
  ])(
    'clears local state and completes when logout fails with %s',
    async (_cause, error) => {
      resetPassword.mockResolvedValue(undefined)
      const user = userEvent.setup()
      const { router, session } = await renderPage(
        '/redefinir-senha?token=token-atual'
      )
      vi.mocked(session.logout).mockRejectedValueOnce(error)

      await user.type(screen.getByLabelText('Nova senha'), 'senha segura')
      await user.type(screen.getByLabelText('Confirme a senha'), 'senha segura')
      await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

      await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
      expect(session.logout).toHaveBeenCalledOnce()
      expect(session.clearLocalSession).toHaveBeenCalledOnce()
      expect(session.handleSessionExpired).not.toHaveBeenCalled()
      expect(session.navigateToLogin).not.toHaveBeenCalled()
      expect(session.initialize).not.toHaveBeenCalled()
    }
  )

  it.each(resetPasswordErrorCases)(
    'shows a recoverable message for %s',
    async (_caseName: string, status: number | undefined, message: string) => {
      resetPassword.mockRejectedValue(
        status === undefined
          ? new ApiError('DETALHE INTERNO', undefined, undefined, undefined, {
              networkError: true,
            })
          : new ApiError('DETALHE INTERNO', status)
      )
      await renderPage('/redefinir-senha?token=token-atual')

      fireEvent.change(screen.getByLabelText('Nova senha'), {
        target: { value: 'senha forte' },
      })
      fireEvent.change(screen.getByLabelText('Confirme a senha'), {
        target: { value: 'senha forte' },
      })
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Redefinir senha' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(message)
      expect(alert).not.toHaveTextContent('DETALHE INTERNO')
      expect(resetPassword).toHaveBeenCalledWith({
        confirmPassword: 'senha forte',
        newPassword: 'senha forte',
        token: 'token-atual',
      })
    }
  )
})

describe('login', () => {
  it('links to the existing password recovery page', async () => {
    await renderPage('/login')

    expect(
      screen.getByRole('link', { name: 'Esqueceu a senha?' })
    ).toHaveAttribute('href', '/esqueci-senha')
  })

  it('toggles the password visibility with the eye button', async () => {
    const user = userEvent.setup()
    await renderPage('/login')
    const password = screen.getByLabelText('Senha')

    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it.each(loginErrorCases)(
    'shows a safe recoverable message for %s',
    async (_caseName, error, message) => {
      login.mockRejectedValue(error)
      await renderPage('/login')

      fireEvent.change(screen.getByLabelText('E-mail'), {
        target: { value: 'conta@example.com' },
      })
      fireEvent.change(screen.getByLabelText('Senha'), {
        target: { value: 'senha segura' },
      })
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Entrar' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(message)
      expect(alert).not.toHaveTextContent('DETALHE INTERNO')
      expect(login).toHaveBeenCalledWith({
        email: 'conta@example.com',
        password: 'senha segura',
      })
    }
  )

  it('submits credentials and shows feedback for an invalid login', async () => {
    login.mockRejectedValue(new ApiError('credenciais inválidas', 401))
    await renderPage('/login')

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: '  conta@example.com  ' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'senha segura' },
    })
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha inválidos.'
    )
    expect(login).toHaveBeenCalledWith({
      email: 'conta@example.com',
      password: 'senha segura',
    })
  })

  it('sends the password exactly as typed, including edge spaces', async () => {
    login.mockRejectedValue(new ApiError('credenciais inválidas', 401))
    await renderPage('/login')

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'conta@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: '  senha segura  ' },
    })
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: 'conta@example.com',
        password: '  senha segura  ',
      })
    )
  })
})
