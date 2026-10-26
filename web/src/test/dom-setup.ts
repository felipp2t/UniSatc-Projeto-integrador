import '@testing-library/jest-dom/vitest'
import { onlineManager } from '@tanstack/react-query'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { clearTestQueryClients } from './query-client-registry'

afterEach(() => {
  cleanup()
  clearTestQueryClients()
  onlineManager.setOnline(true)
})
