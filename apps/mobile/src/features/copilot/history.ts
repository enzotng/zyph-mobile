import { createMMKV } from 'react-native-mmkv'
import type { Block, CopilotTool, CopilotWidgetType } from './schemas'
import { blockSchema } from './schemas'

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

  // Already migrated - blocks array present; validate each element with blockSchema
  // to guard against corrupt persisted records (e.g. { kind: 'bogus' }) that would
  // crash the renderer at assertNever.
  if (Array.isArray(r['blocks'])) {
    const validBlocks: Block[] = r['blocks']
      .map((el: unknown) => blockSchema.safeParse(el))
      .filter((result): result is { success: true; data: Block } => result.success)
      .map((result) => result.data)
    if (validBlocks.length === 0) {
      throw new Error('migrateMessage: blocks array contains no valid blocks')
    }
    return { ...base, blocks: validBlocks }
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
  storage.remove(statesKey(tripId))
}

// ---------------------------------------------------------------------------
// Per-block outcome persistence
// ---------------------------------------------------------------------------
// The chat turns above persist across restarts, but the per-block UI states used to live only in
// React state: after a restart an already-executed action card re-rendered as 'pending' (tappable
// again), letting the user re-run a financial write, and an added itinerary re-armed its
// "Add to timeline" button. Persist the outcomes alongside the chat and re-hydrate them on mount.

export type PersistedBlockStates = {
  // key = `${messageId}:${blockIndex}` (same keying as the screen's state maps)
  actions: Record<string, 'done' | 'cancelled'>
  itineraries: Record<string, 'added'>
}

function statesKey(tripId: string): string {
  return `chat-states-v1:${tripId}`
}

// A fresh object per call: the result seeds React state, so a shared constant could leak
// mutations across screens.
function emptyStates(): PersistedBlockStates {
  return { actions: {}, itineraries: {} }
}

export function loadBlockStates(tripId: string): PersistedBlockStates {
  if (!tripId) {
    return emptyStates()
  }
  const raw = storage.getString(statesKey(tripId))
  if (!raw) {
    return emptyStates()
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return emptyStates()
    }
    const record = parsed as Record<string, unknown>
    const actions: PersistedBlockStates['actions'] = {}
    const rawActions = record['actions']
    if (typeof rawActions === 'object' && rawActions !== null) {
      for (const [k, v] of Object.entries(rawActions as Record<string, unknown>)) {
        if (v === 'done' || v === 'cancelled') {
          actions[k] = v
        } else if (v === 'executing') {
          // The app died mid-execution: the outcome is unknown. Restoring as 'pending' could
          // double-run a financial action, so restore as cancelled - the user can re-ask Zo.
          actions[k] = 'cancelled'
        }
      }
    }
    const itineraries: PersistedBlockStates['itineraries'] = {}
    const rawItineraries = record['itineraries']
    if (typeof rawItineraries === 'object' && rawItineraries !== null) {
      for (const [k, v] of Object.entries(rawItineraries as Record<string, unknown>)) {
        // 'adding' (died mid-add) is intentionally dropped: the card re-arms, and a duplicate
        // event is visible and deletable on the timeline - unlike a duplicated money write.
        if (v === 'added') {
          itineraries[k] = v
        }
      }
    }
    return { actions, itineraries }
  } catch {
    return emptyStates()
  }
}

export function saveBlockStates(
  tripId: string,
  actions: Record<string, string>,
  itineraries: Record<string, string>,
): void {
  if (!tripId) {
    return
  }
  if (Object.keys(actions).length === 0 && Object.keys(itineraries).length === 0) {
    storage.remove(statesKey(tripId))
    return
  }
  storage.set(statesKey(tripId), JSON.stringify({ actions, itineraries }))
}
