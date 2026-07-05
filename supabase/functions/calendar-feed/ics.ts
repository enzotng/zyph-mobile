// Pure RFC 5545 (iCalendar) rendering for the calendar-feed edge function. No Deno-only APIs -
// only TextEncoder/TextDecoder (standard Web APIs, also global in Node/Jest), so this module is
// unit-tested directly from the app's jest runner (see ics.test.ts, discovered via the `roots`
// entry in apps/mobile/jest.config.js) without a Deno shim.

// gate_location is a free-form jsonb column (see database.types.ts / the events detail and edit
// screens, which read it as this same optional-fields shape) - any field can be missing or the
// wrong type on a legacy/hand-edited row, so nothing here is assumed present.
export type GateLocation = {
  label?: string
  lat?: number
  lng?: number
}

export type CalendarEventInput = {
  id: string
  title: string
  notes: string | null
  startsAt: string
  endsAt: string | null
  lat: number | null
  lng: number | null
  locationName: string | null
  gateLocation: GateLocation | null
  updatedAt: string
}

export type BuildCalendarInput = {
  tripTitle: string
  events: CalendarEventInput[]
}

const CRLF = "\r\n"
const FOLD_LIMIT = 75
const CONTINUATION_LIMIT = 74
const ONE_HOUR_MS = 60 * 60 * 1000
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

// RFC 5545 3.3.11 TEXT escaping. Backslash MUST be escaped first - otherwise the backslashes
// inserted by the semicolon/comma/newline steps below would themselves get re-escaped.
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
}

function isUtf8ContinuationByte(byte: number): boolean {
  return (byte & 0xc0) === 0x80
}

// Backs a byte-offset cut point off any UTF-8 continuation byte so a fold never splits a
// multi-byte character (accents, emoji) across two physical lines.
function safeCut(bytes: Uint8Array, start: number, maxLen: number): number {
  let cut = Math.min(start + maxLen, bytes.length)
  while (cut > start && cut < bytes.length && isUtf8ContinuationByte(bytes[cut])) {
    cut--
  }
  return cut
}

// RFC 5545 3.1 line folding, measured in octets (not JS string length): the first physical line
// carries up to 75 bytes; each continuation line is CRLF + one leading space + up to 74 bytes (the
// leading space brings that physical line back up to the 75-octet budget).
export function foldLine(line: string): string {
  const bytes = textEncoder.encode(line)
  if (bytes.length <= FOLD_LIMIT) {
    return line
  }
  const chunks: string[] = []
  let start = 0
  while (start < bytes.length) {
    const limit = chunks.length === 0 ? FOLD_LIMIT : CONTINUATION_LIMIT
    const cut = safeCut(bytes, start, limit)
    chunks.push(textDecoder.decode(bytes.slice(start, cut)))
    start = cut
  }
  return chunks.join(CRLF + " ")
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

// UTC "basic" DATE-TIME required by DTSTART/DTEND/DTSTAMP/LAST-MODIFIED: YYYYMMDDTHHMMSSZ.
function toUtcBasic(iso: string): string {
  const d = new Date(iso)
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

// LOCATION prefers the display name, then the gate override; a blank string is treated as absent.
// gate_location is free-form jsonb, so `label` may not be a string at all (e.g. a hand-edited or
// legacy row) - checked with `typeof` before `.trim()`, which throws on a non-string value.
function resolveLocation(event: CalendarEventInput): string | null {
  const name = event.locationName?.trim()
  if (name) return name
  const label = event.gateLocation?.label
  if (typeof label !== "string") return null
  const trimmed = label.trim()
  return trimmed || null
}

function buildEvent(event: CalendarEventInput): string[] {
  const lines: string[] = []
  lines.push("BEGIN:VEVENT")
  lines.push(`UID:${event.id}@zyph.app`)
  const stamp = toUtcBasic(event.updatedAt)
  lines.push(`DTSTAMP:${stamp}`)
  lines.push(`LAST-MODIFIED:${stamp}`)
  lines.push(`DTSTART:${toUtcBasic(event.startsAt)}`)
  const endsAtIso = event.endsAt ?? new Date(new Date(event.startsAt).getTime() + ONE_HOUR_MS).toISOString()
  lines.push(`DTEND:${toUtcBasic(endsAtIso)}`)
  lines.push(`SUMMARY:${escapeText(event.title)}`)

  const location = resolveLocation(event)
  if (location) {
    lines.push(`LOCATION:${escapeText(location)}`)
  }

  if (
    event.lat !== null &&
    event.lng !== null &&
    Number.isFinite(event.lat) &&
    Number.isFinite(event.lng)
  ) {
    lines.push(`GEO:${event.lat};${event.lng}`)
  }

  if (event.notes && event.notes.trim()) {
    lines.push(`DESCRIPTION:${escapeText(event.notes)}`)
  }

  lines.push("BEGIN:VALARM")
  lines.push("ACTION:DISPLAY")
  lines.push(`DESCRIPTION:${escapeText(event.title)}`)
  lines.push("TRIGGER:-PT1H")
  lines.push("END:VALARM")

  lines.push("END:VEVENT")
  return lines
}

export function buildCalendar({ tripTitle, events }: BuildCalendarInput): string {
  const lines: string[] = []
  lines.push("BEGIN:VCALENDAR")
  lines.push("VERSION:2.0")
  lines.push("PRODID:-//ZYPH//Trip Calendar//EN")
  lines.push("CALSCALE:GREGORIAN")
  lines.push(`X-WR-CALNAME:ZYPH - ${escapeText(tripTitle)}`)
  lines.push("X-PUBLISHED-TTL:PT1H")
  lines.push("REFRESH-INTERVAL;VALUE=DURATION:PT1H")

  for (const event of events) {
    // Isolate each event: gate_location/location_name are free-form jsonb/text that can hold
    // anything on a legacy or hand-edited row. One malformed event must degrade (get skipped),
    // never take down the rest of the trip's calendar with it.
    try {
      lines.push(...buildEvent(event))
    } catch {
      // The id is a UUID (no personal data) - enough to find the offending row.
      console.warn("calendar-feed: skipped malformed event", event.id)
      continue
    }
  }

  lines.push("END:VCALENDAR")

  return lines.map(foldLine).join(CRLF) + CRLF
}
