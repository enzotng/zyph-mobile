import { findInboxRecipient, normalizeLocalPart } from './resolver'
import type { BrevoInboundItem } from './resolver'

describe('normalizeLocalPart', () => {
  it('lower-cases the local part and strips a +suffix, ignoring the domain case', () => {
    expect(normalizeLocalPart('Roadtrip-AB12+x@ZYPH.enzotang.fr')).toBe('roadtrip-ab12')
  })

  it('lower-cases a local part with no +suffix', () => {
    expect(normalizeLocalPart('Roadtrip-Scandinavie@zyph.enzotang.fr')).toBe('roadtrip-scandinavie')
  })
})

const SLUG = 'roadtrip-scandinavie-a1b2c3d4e5f6a7b8c9d0'
const INBOX_ADDRESS = `${SLUG}@zyph.enzotang.fr`

function baseItem(overrides: Partial<BrevoInboundItem> = {}): BrevoInboundItem {
  return {
    From: { Address: 'agent@some-airline.example', Name: 'Some Airline' },
    Subject: 'Your booking confirmation',
    Headers: {},
    ...overrides,
  }
}

describe('findInboxRecipient', () => {
  it('finds the inbox address in To on a direct send', () => {
    const item = baseItem({ To: [{ Address: INBOX_ADDRESS, Name: 'Trip' }] })

    expect(findInboxRecipient(item)).toBe(INBOX_ADDRESS)
  })

  it('finds the inbox address in Recipients (a plain string array, the envelope) when To only has a personal address (real auto-forward shape)', () => {
    const item = baseItem({
      To: [{ Address: 'traveler@example.com', Name: 'Traveler' }],
      Recipients: [INBOX_ADDRESS],
    })

    expect(findInboxRecipient(item)).toBe(INBOX_ADDRESS)
  })

  it('finds the inbox address in Recipients even when its domain is upper-cased', () => {
    const uppercased = `${SLUG}@ZYPH.EnzoTang.FR`
    const item = baseItem({
      To: [{ Address: 'traveler@example.com', Name: 'Traveler' }],
      Recipients: [uppercased],
    })

    expect(findInboxRecipient(item)).toBe(uppercased)
  })

  it('finds the inbox address in Bcc when To/Cc/Recipients have none', () => {
    const item = baseItem({
      To: [{ Address: 'traveler@example.com', Name: 'Traveler' }],
      Bcc: [{ Address: INBOX_ADDRESS, Name: 'Trip' }],
    })

    expect(findInboxRecipient(item)).toBe(INBOX_ADDRESS)
  })

  it('falls back to the Headers Delivered-To value when no metadata field has the address', () => {
    const item = baseItem({
      To: [{ Address: 'traveler@example.com', Name: 'Traveler' }],
      Headers: { 'Delivered-To': INBOX_ADDRESS },
    })

    expect(findInboxRecipient(item)).toBe(INBOX_ADDRESS)
  })

  it('falls back to the Headers Received value when no other field has the address', () => {
    const item = baseItem({
      To: [{ Address: 'traveler@example.com', Name: 'Traveler' }],
      Headers: {
        Received: `from mail-in1.brevo.com by mx.example.com for <${INBOX_ADDRESS}>; Sun, 05 Jul 2026 10:00:00 +0000`,
      },
    })

    expect(findInboxRecipient(item)).toBe(INBOX_ADDRESS)
  })

  it('scans each entry of a repeated (array-valued) header for the inbox address', () => {
    const item = baseItem({
      To: [{ Address: 'traveler@example.com', Name: 'Traveler' }],
      Headers: {
        Received: [
          'from mx1.example.com by mx2.example.com for <traveler@example.com>',
          `from mail-in1.brevo.com by mx.example.com for <${INBOX_ADDRESS}>`,
        ],
      },
    })

    expect(findInboxRecipient(item)).toBe(INBOX_ADDRESS)
  })

  it('extracts the address from an X-Forwarded-To header formatted as "Name <address>"', () => {
    const item = baseItem({
      Headers: { 'X-Forwarded-To': `Trip Roadtrip <${INBOX_ADDRESS}>` },
    })

    expect(findInboxRecipient(item)).toBe(INBOX_ADDRESS)
  })

  it('returns null when no inbox address is found anywhere', () => {
    const item = baseItem({
      To: [{ Address: 'traveler@example.com', Name: 'Traveler' }],
      Headers: { 'Delivered-To': 'traveler@example.com' },
    })

    expect(findInboxRecipient(item)).toBeNull()
  })

  it('rejects a near-miss domain that only contains the inbox domain as a substring', () => {
    const item = baseItem({
      To: [{ Address: `x@evil.zyph.enzotang.fr.attacker.com`, Name: 'Attacker' }],
    })

    expect(findInboxRecipient(item)).toBeNull()
  })
})
