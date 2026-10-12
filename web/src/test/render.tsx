// @vitest-environment happy-dom

import './dom-setup'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  type RenderOptions,
  type RenderResult,
  render as rtlRender,
} from '@testing-library/react'
import type { ReactElement } from 'react'
import { registerTestQueryClient } from './query-client-registry'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Number.POSITIVE_INFINITY, retry: false },
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient
  } = {}
): RenderResult & { queryClient: QueryClient } {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options
  registerTestQueryClient(queryClient)
  return {
    ...rtlRender(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
      renderOptions
    ),
    queryClient,
  }
}
