// env.ts throws at module evaluation time when env vars are missing.
// jest-env.js sets defaults before every file, so the throw path requires
// isolateModules + require() to re-evaluate the module after deleting the vars.
/* eslint-disable @typescript-eslint/no-require-imports */

describe('env', () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_KEY

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl
    process.env.EXPO_PUBLIC_SUPABASE_KEY = originalKey
  })

  it('exports supabaseUrl and supabaseKey when both vars are present', () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
      process.env.EXPO_PUBLIC_SUPABASE_KEY = 'my-anon-key'

      const { env } = require('./env') as { env: { supabaseUrl: string; supabaseKey: string } }
      expect(env.supabaseUrl).toBe('https://example.supabase.co')
      expect(env.supabaseKey).toBe('my-anon-key')
    })
  })

  it('throws with "Missing" when EXPO_PUBLIC_SUPABASE_URL is absent', () => {
    jest.isolateModules(() => {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL
      process.env.EXPO_PUBLIC_SUPABASE_KEY = 'some-key'

      expect(() => require('./env')).toThrow('Missing')
    })
  })

  it('throws with "Missing" when EXPO_PUBLIC_SUPABASE_KEY is absent', () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
      delete process.env.EXPO_PUBLIC_SUPABASE_KEY

      expect(() => require('./env')).toThrow('Missing')
    })
  })

  it('throws with "Missing" when both vars are absent', () => {
    jest.isolateModules(() => {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL
      delete process.env.EXPO_PUBLIC_SUPABASE_KEY

      expect(() => require('./env')).toThrow('Missing')
    })
  })
})
