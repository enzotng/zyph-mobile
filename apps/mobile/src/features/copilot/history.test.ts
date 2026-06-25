import { createMMKV } from 'react-native-mmkv'

import {
  type ChatMessage,
  clearCopilotHistory,
  loadCopilotHistory,
  migrateMessage,
  saveCopilotHistory,
} from './history'

// In-memory MMKV so the round-trip is deterministic without the native module. All createMMKV
// calls share one store (declared inside the factory), so the test can reset it between cases.
jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>()
  return {
    createMMKV: () => ({
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

const mockStore = createMMKV({ id: 'test' }) as unknown as {
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
