import { createMMKV } from 'react-native-mmkv'

import type { Block, CopilotTool, CopilotWidgetType } from './schemas'

// One chat turn shown in the copilot screen. Persisted per trip (plain MMKV, same durability as
// the react-query cache that already holds this trip's data) so the conversation survives
// navigating away from Zo or restarting the app.
export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  blocks: Block[]
  // True for an error bubble.
  error?: boolean
  // For an error bubble: the question to re-send when the user taps Retry.
  retryText?: string
}

// Keep storage bounded: only the most recent turns are retained (the edge function caps the
// re-sent history at 30 messages anyway, so older turns add nothing).
const MAX_STORED = 50

const storage = createMMKV({ id: 'zyph-copilot' })

// Versioned key - bump on shape change so old keys are ignored (not deleted, not crashing).
function key(tripId: string): string {
  return `chat-v2:${tripId}`
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

const COPILOT_TOOLS = ['add_expense', 'add_event', 'add_packing', 'record_settlement'] as const
const COPILOT_WIDGETS = ['weather', 'balances', 'next_events', 'packing', 'expenses'] as const

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isCopilotTool(v: unknown): v is CopilotTool {
  return typeof v === 'string' && (COPILOT_TOOLS as readonly string[]).includes(v)
}

function isCopilotWidget(v: unknown): v is CopilotWidgetType {
  return typeof v === 'string' && (COPILOT_WIDGETS as readonly string[]).includes(v)
}

/**
 * Maps a stored record (any shape) to the current ChatMessage.
 * - Records that already carry a `blocks` array are returned as-is (with only
 *   the known fields kept).
 * - Legacy records (`text`, `action`, `widget`) are converted in order:
 *   1. text block  (if `text` is a non-empty string)
 *   2. widget block (if `widget` is set) OR action block (if `action` object is set)
 */
export function migrateMessage(raw: unknown): ChatMessage {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('migrateMessage: not an object')
  }
  const r = raw as Record<string, unknown>

  const id = r['id']
  const role = r['role']

  if (!isNonEmptyString(id)) {
    throw new Error('migrateMessage: missing id')
  }
  if (role !== 'user' && role !== 'assistant') {
    throw new Error('migrateMessage: invalid role')
  }

  const error = r['error'] === true ? true : undefined
  const retryText = isNonEmptyString(r['retryText']) ? r['retryText'] : undefined

  const base = {
    id,
    role,
    ...(error !== undefined ? { error } : {}),
    ...(retryText !== undefined ? { retryText } : {}),
  } as const

  // Already migrated - blocks array present
  if (Array.isArray(r['blocks'])) {
    return { ...base, blocks: r['blocks'] as Block[] }
  }

  // Legacy shape - build blocks from old fields
  const blocks: Block[] = []

  if (isNonEmptyString(r['text'])) {
    blocks.push({ kind: 'text', text: r['text'] })
  }

  const widget = r['widget']
  const action = r['action']

  if (isCopilotWidget(widget)) {
    blocks.push({ kind: 'widget', source: widget })
  } else if (typeof action === 'object' && action !== null) {
    const a = action as Record<string, unknown>
    if (
      isCopilotTool(a['tool']) &&
      typeof a['args'] === 'object' &&
      a['args'] !== null &&
      isNonEmptyString(a['text'])
    ) {
      blocks.push({
        kind: 'action',
        tool: a['tool'],
        args: a['args'] as Record<string, unknown>,
        text: a['text'],
      })
    }
  }

  return { ...base, blocks }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
    const messages: ChatMessage[] = []
    for (const item of parsed) {
      try {
        messages.push(migrateMessage(item))
      } catch {
        // Drop unparseable records rather than crashing.
      }
    }
    return messages
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
