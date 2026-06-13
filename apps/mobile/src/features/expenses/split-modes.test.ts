import {
  centsToPercent,
  exactToSplits,
  parseCentsInput,
  parsePercentInput,
  percentToSplits,
  validateExactSum,
  validatePercentSum,
} from './split-modes'

const sum = (splits: { shareCents: number }[]) => splits.reduce((s, x) => s + x.shareCents, 0)

describe('parseCentsInput', () => {
  it('parses dot and comma decimals', () => {
    expect(parseCentsInput('12.5')).toBe(1250)
    expect(parseCentsInput('12,50')).toBe(1250)
    expect(parseCentsInput('12.')).toBe(1200)
    expect(parseCentsInput('7')).toBe(700)
  })

  it('returns 0 for empty or malformed input', () => {
    expect(parseCentsInput('')).toBe(0)
    expect(parseCentsInput(undefined)).toBe(0)
    expect(parseCentsInput('abc')).toBe(0)
    expect(parseCentsInput('1.999')).toBe(0)
  })
})

describe('parsePercentInput', () => {
  it('parses dot and comma, rejects garbage and negatives', () => {
    expect(parsePercentInput('33.33')).toBeCloseTo(33.33)
    expect(parsePercentInput('33,33')).toBeCloseTo(33.33)
    expect(parsePercentInput('')).toBe(0)
    expect(parsePercentInput('-5')).toBe(0)
    expect(parsePercentInput('abc')).toBe(0)
    expect(parsePercentInput('150')).toBe(150)
  })
})

describe('exactToSplits', () => {
  it('keeps each amount verbatim, preserving order and zeros, clamping negatives', () => {
    expect(
      exactToSplits([
        { memberId: 'a', cents: 1500 },
        { memberId: 'b', cents: 0 },
        { memberId: 'c', cents: -100 },
      ]),
    ).toEqual([
      { memberId: 'a', shareCents: 1500 },
      { memberId: 'b', shareCents: 0 },
      { memberId: 'c', shareCents: 0 },
    ])
  })
})

describe('percentToSplits', () => {
  it('always sums to the base via largest-remainder', () => {
    const r = percentToSplits(
      [
        { memberId: 'a', percent: 33.33 },
        { memberId: 'b', percent: 33.33 },
        { memberId: 'c', percent: 33.34 },
      ],
      10000,
    )
    expect(sum(r)).toBe(10000)
  })

  it('splits 50/50 of an odd base', () => {
    expect(
      percentToSplits(
        [
          { memberId: 'a', percent: 50 },
          { memberId: 'b', percent: 50 },
        ],
        4501,
      ).map((x) => x.shareCents),
    ).toEqual([2251, 2250])
  })

  it('gives the whole amount to a single 100% member', () => {
    expect(percentToSplits([{ memberId: 'a', percent: 100 }], 4250)).toEqual([
      { memberId: 'a', shareCents: 4250 },
    ])
  })

  it('always distributes the whole base even when percentages do not total 100', () => {
    // The RPC requires sum == base; the not-balanced case is blocked by canSubmit, but the snapped
    // cents must still total the base so a balanced result is never off by rounding.
    const over = percentToSplits(
      [
        { memberId: 'a', percent: 50 },
        { memberId: 'b', percent: 50 },
        { memberId: 'c', percent: 50 },
      ],
      9000,
    )
    expect(sum(over)).toBe(9000)
    const under = percentToSplits(
      [
        { memberId: 'a', percent: 10 },
        { memberId: 'b', percent: 10 },
      ],
      9000,
    )
    expect(sum(under)).toBe(9000)
  })
})

describe('validateExactSum', () => {
  it('flags balanced, under and over', () => {
    expect(
      validateExactSum(
        [
          { memberId: 'a', cents: 1500 },
          { memberId: 'b', cents: 1500 },
          { memberId: 'c', cents: 1500 },
        ],
        4500,
      ),
    ).toEqual({ allocatedCents: 4500, remainderCents: 0, isBalanced: true })
    expect(validateExactSum([{ memberId: 'a', cents: 4000 }], 4500).remainderCents).toBe(500)
    expect(validateExactSum([{ memberId: 'a', cents: 6000 }], 4500).remainderCents).toBe(-1500)
  })

  it('is not balanced when nothing is allocated', () => {
    const c = validateExactSum(
      [
        { memberId: 'a', cents: 0 },
        { memberId: 'b', cents: 0 },
      ],
      4500,
    )
    expect(c.remainderCents).toBe(4500)
    expect(c.isBalanced).toBe(false)
  })
})

describe('validatePercentSum', () => {
  it('is balanced only when percentages sum to exactly 100', () => {
    expect(
      validatePercentSum(
        [
          { memberId: 'a', percent: 33.33 },
          { memberId: 'b', percent: 33.33 },
          { memberId: 'c', percent: 33.34 },
        ],
        10000,
      ).isBalanced,
    ).toBe(true)
    expect(
      validatePercentSum(
        [
          { memberId: 'a', percent: 33 },
          { memberId: 'b', percent: 33 },
          { memberId: 'c', percent: 33 },
        ],
        10000,
      ).isBalanced,
    ).toBe(false)
  })

  it('is not balanced when percentages exceed 100', () => {
    expect(
      validatePercentSum(
        [
          { memberId: 'a', percent: 50 },
          { memberId: 'b', percent: 50 },
          { memberId: 'c', percent: 50 },
        ],
        10000,
      ).isBalanced,
    ).toBe(false)
  })
})

describe('centsToPercent', () => {
  it('sums to 100 (residual on the largest share)', () => {
    const r = centsToPercent(
      [
        { memberId: 'a', shareCents: 600 },
        { memberId: 'b', shareCents: 600 },
        { memberId: 'c', shareCents: 600 },
      ],
      1800,
    )
    expect(r.reduce((s, x) => s + x.percent, 0)).toBeCloseTo(100, 2)
  })

  it('maps a 2:1 split to 66.67 / 33.33', () => {
    expect(
      centsToPercent(
        [
          { memberId: 'a', shareCents: 600 },
          { memberId: 'b', shareCents: 300 },
        ],
        900,
      ),
    ).toEqual([
      { memberId: 'a', percent: 66.67 },
      { memberId: 'b', percent: 33.33 },
    ])
  })

  it('returns zeros when the base is zero', () => {
    expect(centsToPercent([{ memberId: 'a', shareCents: 0 }], 0)).toEqual([
      { memberId: 'a', percent: 0 },
    ])
  })
})
