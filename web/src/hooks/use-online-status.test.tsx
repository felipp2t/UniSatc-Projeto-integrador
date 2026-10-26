// @vitest-environment happy-dom

import { onlineManager } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OfflineBanner } from '@/components/offline-banner'
import '@/test/dom-setup'
import { syncOnlineStatus } from './use-online-status'

const offlineText = /Você está offline/

afterEach(() => {
  vi.unstubAllGlobals()
  onlineManager.setOnline(true)
})

describe('online status', () => {
  it('shows and hides the offline banner', () => {
    const { rerender } = render(<OfflineBanner />)
    expect(screen.queryByText(offlineText)).toBeNull()

    onlineManager.setOnline(false)
    rerender(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Você está offline')

    onlineManager.setOnline(true)
    rerender(<OfflineBanner />)
    expect(screen.queryByText(offlineText)).toBeNull()
  })

  it('synchronizes an initially offline navigator without setting undefined', () => {
    const setOnline = vi.spyOn(onlineManager, 'setOnline')
    vi.stubGlobal('navigator', { onLine: false })

    syncOnlineStatus()

    expect(setOnline).toHaveBeenCalledWith(false)
    expect(onlineManager.isOnline()).toBe(false)
  })
})
