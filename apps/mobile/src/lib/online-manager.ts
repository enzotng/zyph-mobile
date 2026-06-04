import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

// Wire react-query's onlineManager to real device connectivity (via NetInfo). With
// networkMode 'offlineFirst', queries serve cached data offline and refetch on reconnect.
// Runs once when this module is first imported.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected))
  }),
)

// Subscribes a component to the online/offline state. useSyncExternalStore keeps it
// render-safe (no effect, no wall-clock read).
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (callback) => onlineManager.subscribe(callback),
    () => onlineManager.isOnline(),
    () => true,
  )
}
