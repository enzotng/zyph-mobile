import type { TripMember } from '@/features/group'

import { amountToCents, resolveMemberId, resolveSplitMembers, splitEqually } from './actions'

const members: TripMember[] = [
  {
    id: 'm1',
    user_id: 'u1',
    role: 'owner',
    status: 'active',
    display_name: 'Ana',
  },
  {
    id: 'm2',
    user_id: 'u2',
    role: 'member',
    status: 'active',
    display_name: 'Bob',
  },
]

describe('resolveMemberId', () => {
  it('resolves "me"/"moi" to the current user member', () => {
    expect(resolveMemberId('me', members, 'u2')).toBe('m2')
    expect(resolveMemberId('moi', members, 'u1')).toBe('m1')
  })

  it('matches a display name case-insensitively', () => {
    expect(resolveMemberId('ana', members, 'u2')).toBe('m1')
  })

  it('returns null when unresolved', () => {
    expect(resolveMemberId('Zoe', members, 'u1')).toBeNull()
    expect(resolveMemberId('', members, 'u1')).toBeNull()
  })
})

describe('splitEqually', () => {
  it('splits evenly and distributes the remainder to sum exactly', () => {
    expect(splitEqually(1000, ['m1', 'm2'])).toEqual([
      { memberId: 'm1', shareCents: 500 },
      { memberId: 'm2', shareCents: 500 },
    ])
    const three = splitEqually(1000, ['a', 'b', 'c'])
    expect(three.reduce((s, x) => s + x.shareCents, 0)).toBe(1000)
    expect(three[0].shareCents).toBe(334)
  })

  it('returns [] for no members', () => {
    expect(splitEqually(1000, [])).toEqual([])
  })
})

describe('amountToCents', () => {
  it('converts a positive number to cents', () => {
    expect(amountToCents(40)).toBe(4000)
    expect(amountToCents(12.5)).toBe(1250)
  })

  it('rounds half up despite floating-point error', () => {
    expect(amountToCents(1.005)).toBe(101)
    expect(amountToCents(0.1 + 0.2)).toBe(30)
  })

  it('rejects invalid amounts', () => {
    expect(amountToCents(0)).toBeNull()
    expect(amountToCents(-5)).toBeNull()
    expect(amountToCents('40')).toBeNull()
    expect(amountToCents(Number.NaN)).toBeNull()
  })
})

describe('resolveSplitMembers', () => {
  it('returns all members for "all" or a non-array', () => {
    expect(resolveSplitMembers('all', members, 'u1')).toEqual(['m1', 'm2'])
    expect(resolveSplitMembers(undefined, members, 'u1')).toEqual(['m1', 'm2'])
  })

  it('resolves named members', () => {
    expect(resolveSplitMembers(['Bob'], members, 'u1')).toEqual(['m2'])
  })

  it('never widens to all when a named participant does not resolve', () => {
    expect(resolveSplitMembers(['Zoe'], members, 'u1')).toEqual([])
  })
})
