import { computeSplits, rescaleSplits } from './splits'

const sum = (splits: { shareCents: number }[]) => splits.reduce((s, x) => s + x.shareCents, 0)

describe('computeSplits', () => {
  it('splits equally between participants', () => {
    const result = computeSplits(1800, [
      { memberId: 'a', weight: 1 },
      { memberId: 'b', weight: 1 },
      { memberId: 'c', weight: 1 },
    ])
    expect(result).toEqual([
      { memberId: 'a', shareCents: 600 },
      { memberId: 'b', shareCents: 600 },
      { memberId: 'c', shareCents: 600 },
    ])
  })

  it('distributes the remainder to the largest fractions and always sums to the total', () => {
    const result = computeSplits(1000, [
      { memberId: 'a', weight: 1 },
      { memberId: 'b', weight: 1 },
      { memberId: 'c', weight: 1 },
    ])
    // 10.00 / 3 = 3.33.. -> 334 + 333 + 333
    expect(sum(result)).toBe(1000)
    expect(result.map((r) => r.shareCents).sort((x, y) => y - x)).toEqual([334, 333, 333])
  })

  it('splits by weight (2:1)', () => {
    const result = computeSplits(900, [
      { memberId: 'alice', weight: 2 },
      { memberId: 'bob', weight: 1 },
    ])
    expect(result).toEqual([
      { memberId: 'alice', shareCents: 600 },
      { memberId: 'bob', shareCents: 300 },
    ])
  })

  it('returns zero shares when total weight is zero', () => {
    const result = computeSplits(1000, [
      { memberId: 'a', weight: 0 },
      { memberId: 'b', weight: 0 },
    ])
    expect(result).toEqual([
      { memberId: 'a', shareCents: 0 },
      { memberId: 'b', shareCents: 0 },
    ])
  })

  it('handles a single participant taking the whole amount', () => {
    expect(computeSplits(4250, [{ memberId: 'solo', weight: 1 }])).toEqual([
      { memberId: 'solo', shareCents: 4250 },
    ])
  })
})

describe('rescaleSplits', () => {
  const custom = [
    { memberId: 'a', shareCents: 50 },
    { memberId: 'b', shareCents: 30 },
    { memberId: 'c', shareCents: 40 },
  ]

  it('is the identity when the base equals the sum of the shares (untouched edit)', () => {
    // This is the fix for the re-equalise bug: re-saving a custom split without changing the
    // amount must return the exact same shares, not an equal split.
    expect(rescaleSplits(custom, 120)).toEqual(custom)
  })

  it('preserves the ratio when the amount changes', () => {
    // 120 -> 240 doubles every share.
    expect(rescaleSplits(custom, 240)).toEqual([
      { memberId: 'a', shareCents: 100 },
      { memberId: 'b', shareCents: 60 },
      { memberId: 'c', shareCents: 80 },
    ])
  })

  it('keeps an equal split equal after rescaling and always sums to the new base', () => {
    const equal = [
      { memberId: 'a', shareCents: 40 },
      { memberId: 'b', shareCents: 40 },
      { memberId: 'c', shareCents: 40 },
    ]
    const result = rescaleSplits(equal, 100)
    expect(sum(result)).toBe(100)
    expect(result.map((r) => r.shareCents).sort((x, y) => y - x)).toEqual([34, 33, 33])
  })

  it('returns zero shares when the original split was all zeros', () => {
    expect(rescaleSplits([{ memberId: 'a', shareCents: 0 }], 500)).toEqual([
      { memberId: 'a', shareCents: 0 },
    ])
  })
})
