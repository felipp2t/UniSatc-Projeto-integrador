/// <reference types="node" />

import { Writable } from 'node:stream'
import { createElement } from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'

const { captureHeaderProps, navigate, routeContext } = vi.hoisted(() => ({
  captureHeaderProps: vi.fn(),
  navigate: vi.fn(),
  routeContext: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (options: unknown) => ({
      options,
      useRouteContext: routeContext,
    }),
    Outlet: () => null,
    redirect: vi.fn(),
    useNavigate: () => navigate,
  }
})

vi.mock('@/components/header', () => ({
  Header: (props: {
    onLogout?: () => Promise<void>
    userEmail?: string
    userName?: string
  }) => {
    captureHeaderProps(props)
    return createElement('header', {
      'data-user-email': props.userEmail,
      'data-user-name': props.userName,
    })
  },
}))

vi.mock('@/components/not-found-page', () => ({ NotFoundPage: () => null }))
vi.mock('@/components/ui/grid-pattern', () => ({ GridPattern: () => null }))
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) =>
    createElement('div', null, children),
}))

import { Route } from './_protected/layout'

async function renderLayout(session: {
  logout: () => Promise<void>
  user: { email: string; name: string }
}) {
  routeContext.mockReturnValue({ session })
  captureHeaderProps.mockClear()
  const {
    options: { component },
  } = Route
  if (!component) {
    throw new Error('Protected layout component was not registered')
  }
  let markup = ''

  await new Promise<void>((resolve, reject) => {
    const stream = renderToPipeableStream(createElement(component), {
      onAllReady() {
        stream.pipe(
          new Writable({
            final(callback) {
              resolve()
              callback()
            },
            write(chunk, _encoding, callback) {
              markup += chunk.toString()
              callback()
            },
          })
        )
      },
      onError: reject,
    })
  })

  const headerProps = captureHeaderProps.mock.lastCall?.[0]
  if (!headerProps) {
    throw new Error('Header was not rendered')
  }

  return { headerProps, markup }
}

describe('protected layout logout', () => {
  it('passes the user data to Header and navigates to login with replacement after logout', async () => {
    const session = {
      logout: vi.fn().mockResolvedValue(undefined),
      user: { email: 'user@example.com', name: 'User' },
    }
    navigate.mockReset().mockResolvedValue(undefined)

    const { headerProps, markup } = await renderLayout(session)
    await headerProps.onLogout()

    expect(markup).toContain('data-user-name="User"')
    expect(markup).toContain('data-user-email="user@example.com"')
    expect(session.logout).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith({
      replace: true,
      search: { redirect: undefined },
      to: '/login',
    })
  })

  it('keeps the session and does not navigate when logout fails', async () => {
    const error = new ApiError('Serviço indisponível', 503)
    const session = {
      logout: vi.fn().mockRejectedValue(error),
      user: { email: 'user@example.com', name: 'User' },
    }
    navigate.mockReset()

    const { headerProps } = await renderLayout(session)

    await expect(headerProps.onLogout()).rejects.toBe(error)

    expect(session.user).toEqual({
      email: 'user@example.com',
      name: 'User',
    })
    expect(navigate).not.toHaveBeenCalled()
  })
})
