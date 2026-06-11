import { createMMKV } from 'react-native-mmkv'

import type { CopilotAction, CopilotWidgetType } from './schemas'

// One chat turn shown in the copilot screen. Persisted per trip (plain MMKV, same durability as
// the react-query cache that already holds this trip's data) so the conversation survives
// navigating away from Zo or restarting the app.
export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  // True for an error bubble.
  error?: boolean
  // For an error bubble: the question to re-send when the user taps Retry.
  retryText?: string
  // When present, this assistant turn is a proposed action awaiting confirmation.
  action?: CopilotAction
  actionState?: 'pending' | 'executing' | 'done' | 'cancelled'
  // When present, a trip card to render under the answer (rendered from live cached data).
  widget?: CopilotWidgetType
}

// Keep storage bounded: only the most recent turns are retained (the edge function caps the
// re-sent history at 30 messages anyway, so older turns add nothing).
const MAX_STORED = 50

const storage = createMMKV({ id: 'zyph-copilot' })

function key(tripId: string): string {
  return `chat:${tripId}`
}

export function loadCopilotHistory(tripId: string): ChatMessage[] {
  if (!tripId) {
    return []
  }
  const raw = storage.getString(key(tripId))
  if (!raw) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    // An 'executing' state cannot survive a reload (no mutation is in flight), so reset it to
    // 'pending' and let the user confirm the proposed action again.
    return (parsed as ChatMessage[]).map((message) =>
      message.actionState === 'executing' ? { ...message, actionState: 'pending' } : message,
    )
  } catch {
    return []
  }
}

export function saveCopilotHistory(tripId: string, messages: ChatMessage[]): void {
  if (!tripId) {
    return
  }
  const trimmed = messages.length > MAX_STORED ? messages.slice(-MAX_STORED) : messages
  storage.set(key(tripId), JSON.stringify(trimmed))
}

export function clearCopilotHistory(tripId: string): void {
  if (!tripId) {
    return
  }
  storage.remove(key(tripId))
}
