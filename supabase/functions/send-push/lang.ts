// Push-copy language resolution. No Deno-only APIs, so - exactly like
// supabase/functions/receive-booking-email/dedup.ts - this module is unit-tested directly from the
// app's jest runner (see lang.test.ts, discovered via the `roots` entry in
// apps/mobile/jest.config.js) without a Deno shim.

export type Lang = 'en' | 'fr'

// Mirrors apps/mobile/src/lib/i18n: the same supported set and the same English fallback. The two
// must agree, or a device gets push copy in a language its UI is not using.
const SUPPORTED: readonly string[] = ['en', 'fr']
const DEFAULT_LANG: Lang = 'en'

// Maps a stored device locale ("en", "en-US", "fr") to a language the push copy exists in.
// Anything unset or unsupported falls back to English, matching the app.
export function toLang(locale: string | null | undefined): Lang {
  if (typeof locale !== 'string') {
    return DEFAULT_LANG
  }
  const code = locale.trim().toLowerCase().split(/[-_]/)[0]
  return SUPPORTED.includes(code) ? (code as Lang) : DEFAULT_LANG
}
