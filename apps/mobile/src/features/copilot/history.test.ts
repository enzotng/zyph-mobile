import { createMMKV } from 'react-native-mmkv'

import {
  type ChatMessage,
  clearCopilotHistory,
  loadCopilotHistory,
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

const mockStore = createMMKV({ id: 'test' }) as unknown as { clearAll: () => void }

beforeEach(() => {
  mockStore.clearAll()
})

const userTurn: ChatMessage = { id: 'm1', role: 'user', text: 'How much do I owe?' }

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

  it('resets a stale "executing" action to "pending" on load', () => {
    const message: ChatMessage = {
      id: 'm2',
      role: 'assistant',
      text: 'Add the 40 EUR dinner?',
      action: { tool: 'add_expense', args: { amount: 40 }, text: 'Add it?' },
      actionState: 'executing',
    }
    saveCopilotHistory('t1', [message])
    expect(loadCopilotHistory('t1')[0].actionState).toBe('pending')
  })

  it('returns an empty list for corrupt stored data', () => {
    saveCopilotHistory('t1', [userTurn])
    // Overwrite with invalid JSON via the same mocked store.
    ;(createMMKV({ id: 'test' }) as unknown as { set: (k: string, v: string) => void }).set(
      'chat:t1',
      '{ not json',
    )
    expect(loadCopilotHistory('t1')).toEqual([])
  })

  it('keeps only the most recent messages when over the cap', () => {
    const many: ChatMessage[] = Array.from({ length: 60 }, (_, i) => ({
      id: `m${i + 1}`,
      role: 'user',
      text: `q${i + 1}`,
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
})
