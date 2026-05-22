import { computeSplits } from './splits'

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
