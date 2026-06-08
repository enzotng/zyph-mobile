import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import {
  addPackingItem,
  addPackingItems,
  assignPackingItem,
  claimPackingItem,
  deletePackingItem,
  generatePackingSuggestions,
  listPackingItems,
  nudgePackingItem,
  updatePackingItem,
} from './packing.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const invoke = supabase.functions.invoke as jest.Mock
const rpc = supabase.rpc as jest.Mock

const row = {
  id: 'p1',
  trip_id: 't1',
  scope: 'shared',
  owner_id: 'u1',
  label: 'Passport',
  category: 'documents',
  quantity: 1,
  assigned_member: null,
  packed: false,
  created_at: '2026-06-06T00:00:00.000Z',
}

const newItem = {
  tripId: 't1',
  scope: 'shared' as const,
  ownerId: 'u1',
  label: 'Passport',
  category: 'documents' as const,
  quantity: 1,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('listPackingItems', () => {
  it('queries the trip items ordered by creation', async () => {
    const builder = makeQueryBuilder({ data: [row], error: null })
    from.mockReturnValue(builder)

    await expect(listPackingItems('t1')).resolves.toEqual([row])
    expect(from).toHaveBeenCalledWith('packing_items')
    expect(builder.eq).toHaveBeenCalledWith('trip_id', 't1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('boom') }))
    await expect(listPackingItems('t1')).rejects.toThrow('boom')
  })
})

describe('addPackingItem', () => {
  it('inserts the mapped row', async () => {
    const builder = makeQueryBuilder({ data: row, error: null })
    from.mockReturnValue(builder)

    await expect(addPackingItem(newItem)).resolves.toEqual(row)
    expect(builder.insert).toHaveBeenCalledWith({
      trip_id: 't1',
      scope: 'shared',
      owner_id: 'u1',
      label: 'Passport',
      category: 'documents',
      quantity: 1,
      assigned_member: null,
    })
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('nope') }))
    await expect(addPackingItem(newItem)).rejects.toThrow('nope')
  })
})

describe('addPackingItems', () => {
  it('bulk-inserts mapped rows', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    from.mockReturnValue(builder)

    await addPackingItems([newItem, { ...newItem, label: 'Socks', assignedMember: 'm2' }])
    expect(builder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ label: 'Passport', assigned_member: null }),
      expect.objectContaining({ label: 'Socks', assigned_member: 'm2' }),
    ])
  })

  it('does nothing for an empty list', async () => {
    await addPackingItems([])
    expect(from).not.toHaveBeenCalled()
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('bulk fail') }))
    await expect(addPackingItems([newItem])).rejects.toThrow('bulk fail')
  })
})

describe('updatePackingItem', () => {
  it('updates only the provided fields, mapped to columns (never assignment)', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    from.mockReturnValue(builder)

    await updatePackingItem('p1', { packed: true, label: 'Boots' })
    expect(builder.update).toHaveBeenCalledWith({ packed: true, label: 'Boots' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1')
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('up fail') }))
    await expect(updatePackingItem('p1', { quantity: 2 })).rejects.toThrow('up fail')
  })
})

describe('assign/claim/nudge RPCs', () => {
  it('assignPackingItem calls the rpc with snake_case params', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await assignPackingItem('p1', 'm2')
    expect(rpc).toHaveBeenCalledWith('assign_packing_item', { _item_id: 'p1', _member_id: 'm2' })
  })

  it('assignPackingItem sends undefined member id when unassigning', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await assignPackingItem('p1', null)
    expect(rpc).toHaveBeenCalledWith('assign_packing_item', {
      _item_id: 'p1',
      _member_id: undefined,
    })
  })

  it('claimPackingItem and nudgePackingItem call their rpcs', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await claimPackingItem('p1')
    expect(rpc).toHaveBeenCalledWith('claim_packing_item', { _item_id: 'p1' })
    await nudgePackingItem('p1')
    expect(rpc).toHaveBeenCalledWith('nudge_packing_item', { _item_id: 'p1' })
  })

  it('throws when the rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('rpc fail') })
    await expect(assignPackingItem('p1', 'm2')).rejects.toThrow('rpc fail')
  })
})

describe('deletePackingItem', () => {
  it('deletes by id', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    from.mockReturnValue(builder)

    await expect(deletePackingItem('p1')).resolves.toBeUndefined()
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1')
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('del fail') }))
    await expect(deletePackingItem('p1')).rejects.toThrow('del fail')
  })
})

describe('generatePackingSuggestions', () => {
  const input = { destination: 'Lisbon', days: 3, weather: 'mild', language: 'en' }

  it('invokes the edge function and returns its items', async () => {
    const items = [{ label: 'Socks', category: 'clothes', quantity: 3 }]
    invoke.mockResolvedValue({ data: { items }, error: null })

    await expect(generatePackingSuggestions(input)).resolves.toEqual(items)
    expect(invoke).toHaveBeenCalledWith('generate-packing', {
      body: {
        destination: 'Lisbon',
        days: 3,
        weather: 'mild',
        language: 'en',
        activities: '',
        hint: '',
        mode: 'generate',
        existing: [],
        travelers: 1,
        shared: false,
        packLight: false,
      },
    })
  })

  it('forwards group size, shared scope and pack-light flags', async () => {
    invoke.mockResolvedValue({ data: { items: [] }, error: null })

    await generatePackingSuggestions({ ...input, travelers: 4, shared: true, packLight: true })
    expect(invoke).toHaveBeenCalledWith(
      'generate-packing',
      expect.objectContaining({
        body: expect.objectContaining({ travelers: 4, shared: true, packLight: true }),
      }),
    )
  })

  it('returns [] when the function returns no items', async () => {
    invoke.mockResolvedValue({ data: {}, error: null })
    await expect(generatePackingSuggestions(input)).resolves.toEqual([])
  })

  it('throws when the function errors', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('fn down') })
    await expect(generatePackingSuggestions(input)).rejects.toThrow('fn down')
  })
})
