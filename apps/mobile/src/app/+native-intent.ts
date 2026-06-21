import { redirectShareIntentPath } from '@/lib/share-intent'

// expo-router calls this for every incoming deep link before it routes. Thin delegate to the
// pure helper in @/lib/share-intent (kept out of src/app so its test is never scanned as a route).
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return redirectShareIntentPath(path)
}
