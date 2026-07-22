// Pure resolver for the receive-booking-email edge function's inbound-parse webhook payload.
// No Deno-only APIs, so - exactly like supabase/functions/calendar-feed/ics.ts - this module is
// unit-tested directly from the app's jest runner (see resolver.test.ts, discovered via the
// `roots` entry in apps/mobile/jest.config.js) without a Deno shim.

// Milestone 0 finding (validated live): Brevo routes on the envelope recipient and it survives
// auto-forward, but the exact webhook field name is not pinned - so this scans several candidate
// fields rather than depending on one.
export const INBOX_DOMAIN = 'zyph.enzotang.fr'

type BrevoAddress = {
  Address?: string
  Name?: string
}

export interface BrevoInboundItem {
  From?: BrevoAddress
  To?: BrevoAddress[]
  Cc?: BrevoAddress[]
  Bcc?: BrevoAddress[]
  // Confirmed from a live Brevo payload: unlike To/Cc/Bcc, Recipients is a plain string array (the
  // envelope recipients), not {Address}[] - it's what actually survives auto-forward.
  Recipients?: string[]
  Subject?: string
  Headers?: Record<string, string | string[]>
  RawTextBody?: string
  RawHtmlBody?: string
  ExtractedMarkdownMessage?: string
}

// Lower-case the local part and strip a +suffix. "Roadtrip-AB12+x@ZYPH.enzotang.fr" -> "roadtrip-ab12"
export function normalizeLocalPart(address: string): string {
  const local = address.split('@')[0]
  const [base] = local.split('+')
  return base.toLowerCase()
}

// Domain must match INBOX_DOMAIN exactly (case-insensitive), not as a substring, so
// "x@evil.zyph.enzotang.fr.attacker.com" does not match.
function hasInboxDomain(address: string): boolean {
  const at = address.lastIndexOf('@')
  if (at === -1) return false
  const domain = address.slice(at + 1)
  return domain.toLowerCase() === INBOX_DOMAIN.toLowerCase()
}

// Headers may carry "Name <a@b.fr>" - pull the bracketed address out if present, otherwise treat
// the whole value as the address.
function extractAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return match ? match[1] : raw.trim()
}

function findInAddressList(list: Array<string | BrevoAddress> | undefined): string | null {
  if (!list) return null
  for (const entry of list) {
    const address = typeof entry === 'string' ? entry : entry?.Address
    if (typeof address === 'string' && hasInboxDomain(address)) {
      return address
    }
  }
  return null
}

function findInHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) return null
  const values = Array.isArray(value) ? value : [value]
  for (const raw of values) {
    const address = extractAddress(raw)
    if (hasInboxDomain(address)) {
      return address
    }
  }
  return null
}

// Scan, in order, Recipients -> To -> Cc -> Bcc, then the Headers "Delivered-To" /
// "X-Forwarded-To" / "Received" fallback. Recipients is the envelope (most reliable, and the one
// that survives auto-forward when To is a personal address); the display fields come next; headers
// are the last resort for when auto-forward drops the slug everywhere else.
export function findInboxRecipient(item: BrevoInboundItem): string | null {
  const found = findInAddressList(item.Recipients)
  if (found) return found

  const metadataLists = [item.To, item.Cc, item.Bcc]
  for (const list of metadataLists) {
    const found = findInAddressList(list)
    if (found) return found
  }

  const headers = item.Headers ?? {}
  const headerNames = ['Delivered-To', 'X-Forwarded-To', 'Received']
  for (const name of headerNames) {
    const found = findInHeaderValue(headers[name])
    if (found) return found
  }

  return null
}
