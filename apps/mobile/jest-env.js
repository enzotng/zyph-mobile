// Provide dummy public env vars so src/lib/env.ts doesn't throw when modules that
// transitively import the Supabase client are loaded in tests. Runs before the
// module registry for each test file.
process.env.EXPO_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321'
process.env.EXPO_PUBLIC_SUPABASE_KEY ||= 'test-anon-key'
