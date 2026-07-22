import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import { getProposals, rejectProposal, validateProposal } from './inbox.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const rpc = supabase.rpc as jest.Mock

const validRow = {
  id: 'p1',
  trip_id: 't1',
  status: 'pending',
  source: 'email',
  sender_email: 'friend@example.com',
  subject: 'Your booking confirmation',
  events: [
    {
      category: 'transport',
      subcategory: 'transport.flight',
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

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getProposals', () => {
  it('selects, filters by trip and orders newest first', async () => {
    const builder = makeQueryBuilder({ data: [validRow], error: null })
    from.mockReturnValue(builder)

    const result = await getProposals('t1')

    expect(from).toHaveBeenCalledWith('import_proposals')
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.eq).toHaveBeenCalledWith('trip_id', 't1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
  })

  it('drops a row that fails validation instead of throwing', async () => {
    const builder = makeQueryBuilder({
      data: [validRow, { id: 'p2' /* missing required fields */ }],
      error: null,
    })
    from.mockReturnValue(builder)

    const result = await getProposals('t1')

    expect(result).toEqual([expect.objectContaining({ id: 'p1' })])
  })

  it('throws when the query errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('list fail') }))

    await expect(getProposals('t1')).rejects.toThrow('list fail')
  })
})

describe('validateProposal', () => {
  it('calls validate_import_proposal with the resolved events shape', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const events = [
      {
        title: 'Flight ZY123 CDG -> OSL',
        type: 'flight',
        startsAt: '2026-07-10T08:20:00.000Z',
        lat: null,
        lng: null,
        placeId: null,
        participants: null,
      },
    ]

    await validateProposal('p1', events)

    expect(rpc).toHaveBeenCalledWith('validate_import_proposal', {
      _proposal_id: 'p1',
      _events: events,
    })
  })

  it('throws when the rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('not a member') })

    await expect(validateProposal('p1', [])).rejects.toThrow('not a member')
  })
})

describe('rejectProposal', () => {
  it('calls reject_import_proposal with the proposal id', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(rejectProposal('p1')).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('reject_import_proposal', { _proposal_id: 'p1' })
  })

  it('throws when the rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('already validated') })

    await expect(rejectProposal('p1')).rejects.toThrow('already validated')
  })
})
