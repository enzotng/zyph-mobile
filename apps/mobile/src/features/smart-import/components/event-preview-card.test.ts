import type { ParsedEmailEvent } from '../schemas'
import { type PreviewEvent, parsedToPreview, previewsToEvents } from './event-preview-card'

const baseEvent: ParsedEmailEvent = {
  type: 'flight',
  title: 'Flight ZY123 CDG -> OSL',
  startsAt: '2026-07-10T08:20:00+02:00',
  endsAt: '2026-07-10T10:35:00+02:00',
  location: { name: 'Paris Charles de Gaulle Airport', lat: 49.0097, lng: 2.5479 },
  gateLocation: { label: 'Gate K12', lat: 49.0097, lng: 2.5479 },
  endLocation: { name: 'Oslo Airport', lat: 60.1976, lng: 11.1004 },
  participants: [],
  notes: 'Window seat',
  currency: 'EUR',
  priceCents: 12_000,
  confidence: 0.9,
}

function makePreview(overrides: Partial<PreviewEvent> = {}): PreviewEvent {
  return {
    key: 'evt-0',
    source: baseEvent,
    included: true,
    title: baseEvent.title ?? '',
    startsAt: new Date(baseEvent.startsAt as string),
    notes: baseEvent.notes ?? '',
    participantIds: [],
    ...overrides,
  }
}

// A stand-in for `t('smartImport.defaultTitle')` in these tests - every event here has a title,
// so this only matters for the "both empty" fallback test below, which asserts it is actually
// used (not some hardcoded string) by giving it a value distinct from the real English/French copy.
const DEFAULT_TITLE = 'Imported event'

describe('parsedToPreview', () => {
  it('seeds the preview from the parsed event, matching participants against members', () => {
    const members = [{ userId: 'u1', displayName: 'Zoe Tran' }]
    const preview = parsedToPreview(
      { ...baseEvent, participants: ['Zoe Ngoc Mai Tran'] },
      2,
      members,
      'Imported event',
    )

    expect(preview.key).toBe('evt-2')
    expect(preview.title).toBe('Flight ZY123 CDG -> OSL')
    expect(preview.included).toBe(true)
    expect(preview.participantIds).toEqual(['u1'])
  })

  it('falls back to the default title and "now" when the source has neither', () => {
    const preview = parsedToPreview(
      { ...baseEvent, title: null, startsAt: null },
      0,
      [],
      'Imported event',
    )

    expect(preview.title).toBe('Imported event')
    expect(preview.startsAt).toBeInstanceOf(Date)
  })
})

describe('previewsToEvents', () => {
  it('caps title, notes and gate label to the same limits the manual form enforces', () => {
    const preview = makePreview({
      title: 'A'.repeat(200),
      notes: 'B'.repeat(600),
      source: { ...baseEvent, gateLocation: { label: 'C'.repeat(60), lat: 1, lng: 2 } },
    })

    const [event] = previewsToEvents([preview], DEFAULT_TITLE)

    expect(event.title).toHaveLength(120)
    expect(event.notes).toHaveLength(500)
    expect(event.gateLocation?.label).toHaveLength(40)
  })

  it('drops a parsed end date that no longer follows the edited start', () => {
    const preview = makePreview({
      startsAt: new Date('2026-07-10T12:00:00Z'),
      source: { ...baseEvent, endsAt: '2026-07-10T10:35:00Z' },
    })

    const [event] = previewsToEvents([preview], DEFAULT_TITLE)

    expect(event.endsAt).toBeNull()
  })

  it('keeps a parsed end date that still follows the edited start', () => {
    const preview = makePreview({ startsAt: new Date('2026-07-10T08:20:00Z') })

    const [event] = previewsToEvents([preview], DEFAULT_TITLE)

    expect(event.endsAt).toBe(baseEvent.endsAt)
  })

  it('sends the "everyone" sentinel (null) when no participant is selected', () => {
    const preview = makePreview({ participantIds: [] })

    const [event] = previewsToEvents([preview], DEFAULT_TITLE)

    expect(event.participants).toBeNull()
  })

  it('passes through a specific participant subset', () => {
    const preview = makePreview({ participantIds: ['u1', 'u2'] })

    const [event] = previewsToEvents([preview], DEFAULT_TITLE)

    expect(event.participants).toEqual(['u1', 'u2'])
  })

  it('falls back to the caller-provided default title when both the edited field and the source are empty', () => {
    const preview = makePreview({ title: '  ', source: { ...baseEvent, title: null } })

    // A value distinct from the English copy proves the caller's (localized) default is
    // actually threaded through, rather than some hardcoded string inside the transform -
    // this is what regressed a French user's cleared title to English before the fix.
    const [event] = previewsToEvents([preview], 'Evenement importe')

    expect(event.title).toBe('Evenement importe')
  })
})
