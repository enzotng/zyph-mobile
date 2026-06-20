import { useRouter } from 'expo-router'
import { useShareIntentContext } from 'expo-share-intent'
import { useEffect } from 'react'

import { useAuth } from '@/features/auth'
import { setPendingShare } from '@/lib/preferences'

// A booking confirmation is short; cap the payload before it enters navigation/MMKV so a giant
// share can't bloat state.
const MAX_SHARE_CHARS = 10_000
// Below this there isn't enough to parse (an empty selection or a single word) - ignore it.
const MIN_SHARE_CHARS = 10

// Watches for OS share-sheet payloads (iOS share extension / Android SEND) surfaced by
// expo-share-intent and routes them into Smart Import. Mounted under AuthProvider so it can branch
// on session: signed in -> straight to the trip picker; signed out -> stash the text so it
// survives the sign-in redirect and is replayed once authenticated (mirrors the pending invite).
export function ShareIntentRouter() {
  const router = useRouter()
  const { session } = useAuth()
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext()

  useEffect(() => {
    if (!hasShareIntent || !shareIntent) {
      return
    }
    const text = (shareIntent.text ?? shareIntent.webUrl ?? '').trim().slice(0, MAX_SHARE_CHARS)
    // Clear the native payload before navigating: navigation re-renders, and resetting first
    // guarantees this effect can't re-fire with the same intent (avoids a double navigation).
    resetShareIntent()
    if (text.length < MIN_SHARE_CHARS) {
      return
    }
    if (session) {
      router.replace({ pathname: '/share-handler', params: { text } })
    } else {
      setPendingShare(text)
    }
  }, [hasShareIntent, shareIntent, resetShareIntent, router, session])

  return null
}
