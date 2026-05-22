import type { PostgrestError } from '@supabase/supabase-js'

// Test helpers for the manual Supabase mock (src/lib/__mocks__/supabase.ts).
// They model the PostgREST query builder: chain methods return the builder, the
// builder is awaitable (thenable), and the terminal .single()/.maybeSingle()
// resolve to the same configured result.

export type MockResult<T> = { data: T; error: null } | { data: null; error: PostgrestError }

const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'delete',
  'upsert',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'is',
  'like',
  'ilike',
  'match',
  'order',
  'limit',
  'range',
  'filter',
  'contains',
  'or',
  'not',
] as const

type ChainMethod = (typeof CHAIN_METHODS)[number]

export type QueryBuilderMock<T> = Record<ChainMethod, jest.Mock> & {
  single: jest.Mock<Promise<MockResult<T>>>
  maybeSingle: jest.Mock<Promise<MockResult<T>>>
  then: <R, E = never>(
    onFulfilled: (value: MockResult<T>) => R,
    onRejected?: (reason: unknown) => E,
  ) => Promise<R | E>
}

// Builds a chainable, awaitable PostgREST query-builder stub resolving to `result`.
export function makeQueryBuilder<T>(result: MockResult<T>): QueryBuilderMock<T> {
  const builder: Record<string, unknown> = {}
  for (const method of CHAIN_METHODS) {
    builder[method] = jest.fn(() => builder)
  }
  builder.single = jest.fn(() => Promise.resolve(result))
  builder.maybeSingle = jest.fn(() => Promise.resolve(result))
  builder.then = <R, E = never>(
    onFulfilled: (value: MockResult<T>) => R,
    onRejected?: (reason: unknown) => E,
  ) => Promise.resolve(result).then(onFulfilled, onRejected)
  return builder as unknown as QueryBuilderMock<T>
}

// Minimal PostgrestError for error-path assertions. An Error instance so that the
// api layer's `throw error` works with Jest's `.toThrow(message)`.
export function makePostgrestError(message: string): PostgrestError {
  const error = new Error(message) as Error & { details: string; hint: string; code: string }
  error.details = ''
  error.hint = ''
  error.code = 'MOCK'
  return error as unknown as PostgrestError
}
