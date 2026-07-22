import type { Poi } from '@/features/places'
import { openEncryptedMMKV } from '@/lib/storage-encryption'

import {
  type ChatMessage,
  clearCopilotHistory,
  loadBlockStates,
  loadCopilotCandidates,
  loadCopilotHistory,
  mergeCandidates,
  migrateMessage,
  saveBlockStates,
  saveCopilotCandidates,
  saveCopilotHistory,
} from './history'

// In-memory store so the round-trip is deterministic without the native module. All
// openEncryptedMMKV calls share one store (declared inside the factory), so the test can
// reset it between cases.
jest.mock('@/lib/storage-encryption', () => {
  const store = new Map<string, string>()
  return {
    openEncryptedMMKV: () => ({
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => {
        store.set(key, value)
      },
      remove: (key: string) => {
        store.delete(key)
      },
      clearAll: () => {
        store.clear()
      },
    }),
  }
})

const mockStore = openEncryptedMMKV('test') as unknown as {
  clearAll: () => void
  set: (k: string, v: string) => void
}

beforeEach(() => {
  mockStore.clearAll()
})

// ---------------------------------------------------------------------------
// migrateMessage
// ---------------------------------------------------------------------------

describe('migrateMessage', () => {
  it('legacy text-only -> one text block', () => {
    const result = migrateMessage({ id: 'm1', role: 'user', text: 'How much do I owe?' })
    expect(result).toEqual({
      id: 'm1',
      role: 'user',
      blocks: [{ kind: 'text', text: 'How much do I owe?' }],
    })
  })

  it('legacy text+widget -> [text, widget] blocks', () => {
    const result = migrateMessage({
      id: 'm2',
      role: 'assistant',
      text: 'Here are the balances:',
      widget: 'balances',
    })
    expect(result).toEqual({
      id: 'm2',
      role: 'assistant',
      blocks: [
        { kind: 'text', text: 'Here are the balances:' },
        { kind: 'widget', source: 'balances' },
      ],
    })
  })

  it('legacy action -> one action block (with tool/args/text)', () => {
    const result = migrateMessage({
      id: 'm3',
      role: 'assistant',
      text: 'Add the 40 EUR dinner?',
      action: { tool: 'add_expense', args: { amount: 40, currency: 'EUR' }, text: 'Add it?' },
      actionState: 'executing',
    })
    expect(result).toEqual({
      id: 'm3',
      role: 'assistant',
      blocks: [
        { kind: 'text', text: 'Add the 40 EUR dinner?' },
        {
          kind: 'action',
          tool: 'add_expense',
          args: { amount: 40, currency: 'EUR' },
          text: 'Add it?',
        },
      ],
    })
  })

  it('already-blocks record passes through unchanged', () => {
    const input: ChatMessage = {
      id: 'm4',
      role: 'assistant',
      blocks: [{ kind: 'text', text: 'Already migrated.' }],
    }
    expect(migrateMessage(input)).toEqual(input)
  })

  it('preserves error and retryText on legacy records', () => {
    const result = migrateMessage({
      id: 'm5',
      role: 'assistant',
      text: 'Something went wrong.',
      error: true,
      retryText: 'What is the weather?',
    })
    expect(result).toEqual({
      id: 'm5',
      role: 'assistant',
      blocks: [{ kind: 'text', text: 'Something went wrong.' }],
      error: true,
      retryText: 'What is the weather?',
    })
  })

  it('throws on non-object input', () => {
    expect(() => migrateMessage(null)).toThrow()
    expect(() => migrateMessage('string')).toThrow()
    expect(() => migrateMessage(42)).toThrow()
  })

  it('throws on missing id', () => {
    expect(() => migrateMessage({ role: 'user', text: 'hi' })).toThrow()
  })

  it('throws on invalid role', () => {
    expect(() => migrateMessage({ id: 'm1', role: 'system', text: 'hi' })).toThrow()
  })

  it('throws when already-blocks record contains only invalid blocks', () => {
    expect(() =>
      migrateMessage({ id: 'm1', role: 'assistant', blocks: [{ kind: 'bogus' }] }),
    ).toThrow()
  })

  it('keeps only valid blocks when already-blocks record mixes valid and invalid', () => {
    const result = migrateMessage({
      id: 'm1',
      role: 'assistant',
      blocks: [{ kind: 'text', text: 'Hello' }, { kind: 'bogus' }],
    })
    expect(result.blocks).toEqual([{ kind: 'text', text: 'Hello' }])
  })
})

// ---------------------------------------------------------------------------
// Persistence (round-trips with new MMKV key chat-v2:<tripId>)
// ---------------------------------------------------------------------------

const userTurn: ChatMessage = {
  id: 'm1',
  role: 'user',
  blocks: [{ kind: 'text', text: 'How much do I owe?' }],
}

describe('copilot history persistence', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(loadCopilotHistory('t1')).toEqual([])
  })

  it('round-trips a conversation per trip', () => {
    saveCopilotHistory('t1', [userTurn])
    expect(loadCopilotHistory('t1')).toEqual([userTurn])
    // Keyed by trip: another trip is unaffected.
    expect(loadCopilotHistory('t2')).toEqual([])
  })

  it('returns an empty list for corrupt stored data', () => {
    saveCopilotHistory('t1', [userTurn])
    // Overwrite with invalid JSON via the same mocked store.
    mockStore.set('chat-v2:t1', '{ not json')
    expect(loadCopilotHistory('t1')).toEqual([])
  })

  it('drops unparseable records instead of crashing', () => {
    mockStore.set('chat-v2:t1', JSON.stringify([{ bad: 'record' }, userTurn]))
    const loaded = loadCopilotHistory('t1')
    // The bad record is dropped; the valid one is kept.
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('m1')
  })

  it('keeps only the most recent messages when over the cap', () => {
    const many: ChatMessage[] = Array.from({ length: 60 }, (_, i) => ({
      id: `m${i + 1}`,
      role: 'user',
      blocks: [{ kind: 'text', text: `q${i + 1}` }],
    }))
    saveCopilotHistory('t1', many)
    const loaded = loadCopilotHistory('t1')
    expect(loaded).toHaveLength(50)
    // The last 50 are kept (m11..m60).
    expect(loaded[0].id).toBe('m11')
    expect(loaded[49].id).toBe('m60')
  })

  it('clears a trip conversation', () => {
    saveCopilotHistory('t1', [userTurn])
    clearCopilotHistory('t1')
    expect(loadCopilotHistory('t1')).toEqual([])
  })

  it('ignores an empty trip id', () => {
    saveCopilotHistory('', [userTurn])
    expect(loadCopilotHistory('')).toEqual([])
  })

  it('drops a record with only invalid blocks on load', () => {
    mockStore.set(
      'chat-v2:t1',
      JSON.stringify([{ id: 'm99', role: 'assistant', blocks: [{ kind: 'bogus' }] }, userTurn]),
    )
    const loaded = loadCopilotHistory('t1')
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('m1')
  })

  it('migrates legacy stored messages on load', () => {
    // Simulate old data stored under the old key format (will simply not be found by v2 key).
    // Instead store legacy JSON directly under the v2 key to test loadCopilotHistory migration.
    mockStore.set(
      'chat-v2:t1',
      JSON.stringify([{ id: 'l1', role: 'assistant', text: 'Hello!', widget: 'weather' }]),
    )
    const loaded = loadCopilotHistory('t1')
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toEqual({
      id: 'l1',
      role: 'assistant',
      blocks: [
        { kind: 'text', text: 'Hello!' },
        { kind: 'widget', source: 'weather' },
      ],
    })
  })
})

// ---------------------------------------------------------------------------
// per-block outcome persistence (action / itinerary states)
// ---------------------------------------------------------------------------

describe('copilot block-state persistence', () => {
  it('round-trips terminal action and itinerary states', () => {
    saveBlockStates('t1', { 'm1:0': 'done', 'm2:1': 'cancelled' }, { 'm3:0': 'added' })
    expect(loadBlockStates('t1')).toEqual({
      actions: { 'm1:0': 'done', 'm2:1': 'cancelled' },
      itineraries: { 'm3:0': 'added' },
    })
  })

  it('restores a persisted executing action as cancelled (never re-armed)', () => {
    saveBlockStates('t1', { 'm1:0': 'executing' }, {})
    expect(loadBlockStates('t1').actions).toEqual({ 'm1:0': 'cancelled' })
  })

  it('drops transient/unknown values on load', () => {
    saveBlockStates('t1', { 'm1:0': 'pending', 'm2:0': 'bogus' }, { 'm3:0': 'adding' })
    expect(loadBlockStates('t1')).toEqual({ actions: {}, itineraries: {} })
  })

  it('returns empty states for an unknown trip or corrupt payload', () => {
    expect(loadBlockStates('nope')).toEqual({ actions: {}, itineraries: {} })
    mockStore.set('chat-states-v1:t9', 'not json')
    expect(loadBlockStates('t9')).toEqual({ actions: {}, itineraries: {} })
  })

  it('saving empty maps removes the stored entry', () => {
    saveBlockStates('t1', { 'm1:0': 'done' }, {})
    saveBlockStates('t1', {}, {})
    expect(loadBlockStates('t1')).toEqual({ actions: {}, itineraries: {} })
  })

  it('clearCopilotHistory also clears the block states', () => {
    saveBlockStates('t1', { 'm1:0': 'done' }, { 'm2:0': 'added' })
    clearCopilotHistory('t1')
    expect(loadBlockStates('t1')).toEqual({ actions: {}, itineraries: {} })
  })
})

// ---------------------------------------------------------------------------
// Itinerary candidate persistence (mergeCandidates + candidates-v1:<tripId>)
// ---------------------------------------------------------------------------

function poi(overrides: Partial<Poi> & Pick<Poi, 'placeId'>): Poi {
  return {
    placeId: overrides.placeId,
    name: overrides.name ?? `Place ${overrides.placeId}`,
    lat: overrides.lat ?? 48.85,
    lng: overrides.lng ?? 2.35,
    rating: overrides.rating ?? null,
    ratingCount: overrides.ratingCount ?? null,
    priceLevel: overrides.priceLevel ?? null,
    types: overrides.types ?? [],
    photoName: overrides.photoName ?? null,
    address: overrides.address ?? null,
    openNow: overrides.openNow ?? null,
    description: overrides.description ?? null,
    typeLabel: overrides.typeLabel ?? null,
    priceStart: overrides.priceStart ?? null,
    priceEnd: overrides.priceEnd ?? null,
    priceCurrency: overrides.priceCurrency ?? null,
    weekdayHours: overrides.weekdayHours ?? null,
  }
}

describe('mergeCandidates', () => {
  it('unions two lists and keeps prior entries', () => {
    const merged = mergeCandidates([poi({ placeId: 'a' })], [poi({ placeId: 'b' })])
    expect(merged.map((p) => p.placeId)).toEqual(['a', 'b'])
  })

  it('newest wins on a duplicate placeId', () => {
    const merged = mergeCandidates(
      [poi({ placeId: 'a', name: 'Old' })],
      [poi({ placeId: 'a', name: 'New' })],
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].name).toBe('New')
  })

  it('returns the same prev reference when next is empty (failed search must not wipe)', () => {
    const prev = [poi({ placeId: 'a' })]
    expect(mergeCandidates(prev, [])).toBe(prev)
  })
})

describe('copilot candidate persistence', () => {
  it('round-trips candidates per trip', () => {
    const pois = [poi({ placeId: 'a' }), poi({ placeId: 'b' })]
    saveCopilotCandidates('t1', pois)
    expect(loadCopilotCandidates('t1')).toEqual(pois)
    // Keyed by trip: another trip is unaffected.
    expect(loadCopilotCandidates('t2')).toEqual([])
  })

  it('drops per-element entries that fail poiSchema, keeps the valid ones', () => {
    mockStore.set(
      'candidates-v1:t1',
      JSON.stringify([poi({ placeId: 'a' }), { placeId: '', name: 'bogus' }, { not: 'a poi' }]),
    )
    const loaded = loadCopilotCandidates('t1')
    expect(loaded).toHaveLength(1)
    expect(loaded[0].placeId).toBe('a')
  })

  it('returns an empty list for corrupt JSON', () => {
    mockStore.set('candidates-v1:t1', '{ not json')
    expect(loadCopilotCandidates('t1')).toEqual([])
  })

  it('saving an empty list removes the stored entry', () => {
    saveCopilotCandidates('t1', [poi({ placeId: 'a' })])
    saveCopilotCandidates('t1', [])
    expect(loadCopilotCandidates('t1')).toEqual([])
  })

  it('caps the persisted snapshot at 100, keeping the most recent', () => {
    const many = Array.from({ length: 120 }, (_, i) => poi({ placeId: `p${i}` }))
    saveCopilotCandidates('t1', many)
    const loaded = loadCopilotCandidates('t1')
    expect(loaded).toHaveLength(100)
    // The last 100 are kept (p20..p119).
    expect(loaded[0].placeId).toBe('p20')
    expect(loaded[99].placeId).toBe('p119')
  })

  it('ignores an empty trip id', () => {
    saveCopilotCandidates('', [poi({ placeId: 'a' })])
    expect(loadCopilotCandidates('')).toEqual([])
  })

  it('caps an oversized stored blob on read, keeping the most recent', () => {
    // Written directly (bypassing the write-side cap) to simulate a foreign oversized blob.
    const many = Array.from({ length: 150 }, (_, i) => poi({ placeId: `p${i}` }))
    mockStore.set('candidates-v1:t1', JSON.stringify(many))
    const loaded = loadCopilotCandidates('t1')
    expect(loaded).toHaveLength(100)
    expect(loaded[0].placeId).toBe('p50')
    expect(loaded[99].placeId).toBe('p149')
  })

  it('clearCopilotHistory removes the candidates key', () => {
    saveCopilotCandidates('t1', [poi({ placeId: 'a' })])
    clearCopilotHistory('t1')
    expect(loadCopilotCandidates('t1')).toEqual([])
  })
})
