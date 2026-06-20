import { getShareExtensionKey } from 'expo-share-intent'

// expo-router calls this for every incoming deep link before it routes.
// expo-share-intent wakes the app with a sentinel link (zyph://dataUrl=...zyphShareKey) when an OS
// share lands; that link maps to no real route. Redirect only the sentinel to home, where
// ShareIntentRouter (mounted in _layout) reads the native payload and routes to /share-handler.
// Every other path passes through untouched, so genuine unknown links still resolve as a 404.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes(getShareExtensionKey())) {
    return '/'
  }
  return path
}
