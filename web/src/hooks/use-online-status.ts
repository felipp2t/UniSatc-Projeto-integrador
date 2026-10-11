import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

const subscribe = (listener: () => void) => onlineManager.subscribe(listener)
const getSnapshot = () => onlineManager.isOnline() ?? true

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
