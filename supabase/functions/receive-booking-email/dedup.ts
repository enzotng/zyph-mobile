// Pure fuzzy dedup signature for the receive-booking-email edge function. No Deno-only APIs, so -
// exactly like supabase/functions/calendar-feed/ics.ts - this module is unit-tested directly from
// the app's jest runner (see dedup.test.ts, discovered via the `roots` entry in
// apps/mobile/jest.config.js) without a Deno shim.

const TITLE_PREFIX_LENGTH = 20
// Unicode combining diacritical marks block, left behind by NFD decomposition (e.g. "e" + combining
// acute for "é") - stripping it is how accents get removed below.
const COMBINING_MARKS = /[\u0300-\u036f]/g

// Lower-cased, alphanumerics only, first 20 chars: strips accents (via NFD + combining-mark
// removal) and punctuation/spaces before truncating.
function normalizeTitlePrefix(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, TITLE_PREFIX_LENGTH)
}

// Fuzzy signature to flag likely duplicates (two members forwarding the same email, or a
// re-forward). There is no structured flight-number field, so this is intentionally fuzzy: trip +
// day + a normalized title prefix.
export function dedupSignature(tripId: string, event: { startsAt: string; title: string }): string {
  const day = event.startsAt.slice(0, 10)
  const titlePrefix = normalizeTitlePrefix(event.title)
  return `${tripId}:${day}:${titlePrefix}`
}
