import { getShareExtensionKey } from 'expo-share-intent'

// expo-share-intent wakes the app with a sentinel deep link (zyph://dataUrl=...zyphShareKey) when
// an OS share lands; that link maps to no real route. Redirect only the sentinel to home, where
// ShareIntentRouter (mounted in _layout) reads the native payload and routes to /share-handler.
// Every other path passes through untouched, so genuine unknown links still resolve as a 404.
// Lives in lib (not src/app) so it stays unit-testable: expo-router treats every file under
// src/app as a route and would bundle a colocated test into the app.
export function redirectShareIntentPath(path: string): string {
  if (path.includes(getShareExtensionKey())) {
    return '/'
  }
  return path
}
