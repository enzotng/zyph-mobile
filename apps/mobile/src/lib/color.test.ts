import { withAlpha } from './color'

describe('withAlpha', () => {
  it('converts a 6-digit hex to rgba', () => {
    expect(withAlpha('#4F46E5', 0.1)).toBe('rgba(79, 70, 229, 0.1)')
  })

  it('expands a 3-digit hex', () => {
    expect(withAlpha('#abc', 0.5)).toBe('rgba(170, 187, 204, 0.5)')
  })

  it('tolerates a missing leading hash', () => {
    expect(withAlpha('38BDF8', 1)).toBe('rgba(56, 189, 248, 1)')
  })

  it('clamps alpha to the 0-1 range', () => {
    expect(withAlpha('#000000', 2)).toBe('rgba(0, 0, 0, 1)')
    expect(withAlpha('#000000', -1)).toBe('rgba(0, 0, 0, 0)')
  })

  it('returns non-hex input unchanged instead of producing NaN', () => {
    expect(withAlpha('transparent', 0.5)).toBe('transparent')
    expect(withAlpha('#12', 0.5)).toBe('#12')
  })
})
