import type { QueryClient } from '@tanstack/react-query'

const clients = new Set<QueryClient>()

export function registerTestQueryClient(client: QueryClient) {
  clients.add(client)
  return client
}

export function clearTestQueryClients() {
  for (const client of clients) {
    client.clear()
  }
  clients.clear()
}
