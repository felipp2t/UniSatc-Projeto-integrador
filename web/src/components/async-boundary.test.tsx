// @vitest-environment happy-dom

import { QueryClient, useQuery } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AsyncBoundary } from './async-boundary'
import { ErrorState } from './ui/error-state'
import { LoadingState } from './ui/loading-state'
import { OfflineState } from './ui/offline-state'

afterEach(() => vi.restoreAllMocks())

function QueryView({
  queryKey = ['items'],
  queryFn,
}: {
  queryKey?: string[]
  queryFn: () => Promise<string[]>
}) {
  const query = useQuery({ queryFn, queryKey })
  return (
    <AsyncBoundary query={query}>
      {(items) => <div>{items.join(',')}</div>}
    </AsyncBoundary>
  )
}

const emptyQuery = async () => []
const itemQuery = async () => ['item']

describe('AsyncBoundary', () => {
  it('shows empty state for an empty list', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['items'], [])
    renderWithProviders(<QueryView queryFn={emptyQuery} />, { queryClient })
    expect(screen.getByText('Nenhum resultado encontrado.')).toBeInTheDocument()
  })

  it('shows offline state for a paused initial query', async () => {
    const queryClient = new QueryClient()
    queryClient.setDefaultOptions({ queries: { networkMode: 'online' } })
    const { onlineManager } = await import('@tanstack/react-query')
    onlineManager.setOnline(false)
    renderWithProviders(<QueryView queryFn={itemQuery} />, {
      queryClient,
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Você está offline'
    )
  })

  it('keeps existing data when a refetch fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(['items'], ['old'])
    const queryFn = vi.fn().mockRejectedValue(new Error('failed'))
    renderWithProviders(<QueryView queryFn={queryFn} />, { queryClient })
    expect(screen.getByText('old')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('old')).toBeInTheDocument()
  })

  it('retries an error when the accessible button is clicked', async () => {
    const queryFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce(['new'])
    renderWithProviders(<QueryView queryFn={queryFn} />)
    const retry = await screen.findByRole('button', {
      name: 'Tentar novamente',
    })
    await act(async () => retry.click())
    await waitFor(() => expect(screen.getByText('new')).toBeInTheDocument())
    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  it('renders the real loading state accessibly', () => {
    render(<LoadingState />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Carregando...')).toBeInTheDocument()
  })

  it('renders the offline state accessibly', () => {
    render(<OfflineState />)
    expect(screen.getByRole('status')).toHaveTextContent('Você está offline')
  })

  it('renders classified error messages', () => {
    render(<ErrorState error={new Error('Falha inesperada')} />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível concluir a operação.'
    )
  })
})
