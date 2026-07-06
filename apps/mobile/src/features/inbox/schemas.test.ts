import { importProposalSchema } from './schemas'

const row = {
  id: 'p1',
  trip_id: 't1',
  status: 'pending',
  source: 'email',
  sender_email: 'friend@example.com',
  subject: 'Your booking confirmation',
  events: [
    {
      type: 'flight',
      title: 'Flight ZY123 CDG -> OSL',
      startsAt: '2026-07-10T08:20:00Z',
      endsAt: null,
      location: null,
      gateLocation: null,
      endLocation: null,
      participants: [],
      notes: null,
      currency: null,
      priceCents: null,
      confidence: 0.8,
    },
  ],
  received_at: '2026-07-05T12:00:00Z',
  created_at: '2026-07-05T12:00:01Z',
}

describe('importProposalSchema', () => {
  it('parses a well-formed row', () => {
    const result = importProposalSchema.safeParse(row)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('pending')
      expect(result.data.events).toHaveLength(1)
    }
  })

  it('degrades an unexpected status/source to a safe default', () => {
    const parsed = importProposalSchema.parse({ ...row, status: 'weird', source: 'fax' })
    expect(parsed.status).toBe('pending')
    expect(parsed.source).toBe('email')
  })

  it('degrades a malformed events blob to null instead of rejecting the row', () => {
    const parsed = importProposalSchema.parse({ ...row, events: 'not an array' })
    expect(parsed.events).toBeNull()
  })

  it('accepts a null events array (nothing extracted)', () => {
    const parsed = importProposalSchema.parse({ ...row, events: null })
    expect(parsed.events).toBeNull()
  })
})
