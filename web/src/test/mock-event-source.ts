import { vi } from 'vitest'

export class MockEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static instances: MockEventSource[] = []
  readonly url: string | URL
  readonly init?: EventSourceInit
  readyState = MockEventSource.CONNECTING
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  listeners = new Map<string, EventListener>()
  close = vi.fn(() => {
    this.readyState = MockEventSource.CLOSED
  })
  addEventListener = vi.fn((type: string, listener: EventListener) => {
    this.listeners.set(type, listener)
  })
  removeEventListener = vi.fn((type: string) => {
    this.listeners.delete(type)
  })

  constructor(url: string | URL, init?: EventSourceInit) {
    this.url = url
    this.init = init
    MockEventSource.instances.push(this)
  }

  open() {
    this.readyState = MockEventSource.OPEN
    this.onopen?.()
  }

  fail(state = MockEventSource.CLOSED) {
    this.readyState = state
    this.onerror?.()
  }

  notify() {
    this.listeners.get('notification')?.(new Event('notification'))
  }
}
