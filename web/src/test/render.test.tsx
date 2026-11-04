// @vitest-environment happy-dom

import { QueryClient } from '@tanstack/react-query'
import { cleanup } from '@testing-library/react'
import { expect, it } from 'vitest'
import { clearTestQueryClients } from './query-client-registry'
import { renderWithProviders } from './render'

it('clears supplied and default clients during teardown', () => {
  const suppliedClient = new QueryClient()
  suppliedClient.setQueryData(['supplied'], ['item'])
  renderWithProviders(<div />, { queryClient: suppliedClient })
  const { queryClient: defaultClient } = renderWithProviders(<div />)
  defaultClient.setQueryData(['default'], ['item'])

  cleanup()
  clearTestQueryClients()

  expect(suppliedClient.getQueryCache().getAll()).toEqual([])
  expect(defaultClient.getQueryCache().getAll()).toEqual([])
})
