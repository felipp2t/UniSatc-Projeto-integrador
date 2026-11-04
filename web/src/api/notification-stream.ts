import { env } from '@/config/env'
import { toApiError } from './errors'

const INITIAL_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000
const TRAILING_SLASHES = /\/+$/

// The HTTP sync also uses the session's Axios interceptor to renew expired tokens.
export function startNotificationStream(
  synchronize: (signal: AbortSignal) => Promise<void>
) {
  const controller = new AbortController()
  let source: EventSource | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let resumeTimer: ReturnType<typeof setTimeout> | undefined
  let retryMs = INITIAL_RETRY_MS
  let running = false
  let requested = false

  function closeSource() {
    if (!source) return
    source.onopen = null
    source.onerror = null
    source.removeEventListener('notification', requestSync)
    source.close()
    source = undefined
  }

  function stop() {
    controller.abort()
    clearTimeout(timer)
    clearTimeout(resumeTimer)
    closeSource()
    if (typeof window !== 'undefined')
      window.removeEventListener('focus', synchronizeOnResume)
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') synchronizeOnResume()
  }

  function synchronizeOnResume() {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    if (resumeTimer !== undefined) return
    resumeTimer = setTimeout(() => {
      resumeTimer = undefined
      requestSync()
    }, 0)
  }

  function retry() {
    closeSource()
    if (controller.signal.aborted || timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      requestSync()
    }, retryMs)
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
  }

  function connect() {
    const baseUrl = env.apiUrl.replace(TRAILING_SLASHES, '')
    const connection = new EventSource(`${baseUrl}/notifications/stream`, {
      withCredentials: true,
    })
    source = connection
    connection.onopen = requestSync
    connection.addEventListener('notification', requestSync)
    connection.onerror = () => {
      // CONNECTING is handled by EventSource; CLOSED requires a new connection.
      if (
        source === connection &&
        connection.readyState === EventSource.CLOSED
      ) {
        retry()
      }
    }
  }

  function handleFailure(error: unknown) {
    if (controller.signal.aborted) return
    const { status } = toApiError(error)
    if (status === 401 || status === 403) stop()
    else retry()
  }

  async function drain() {
    if (running || controller.signal.aborted) return
    running = true
    requested = false
    try {
      await synchronize(controller.signal)
      if (controller.signal.aborted) return
      if (source?.readyState === EventSource.OPEN) retryMs = INITIAL_RETRY_MS
      if (!source && timer === undefined) connect()
    } catch (error) {
      handleFailure(error)
    } finally {
      running = false
      if (requested && !controller.signal.aborted && timer === undefined)
        requestSync()
    }
  }

  function requestSync() {
    requested = true
    if (timer === undefined) drain()
  }

  if (typeof window !== 'undefined')
    window.addEventListener('focus', synchronizeOnResume)
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', handleVisibilityChange)
  requestSync()
  return stop
}
