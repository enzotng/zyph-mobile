import { coverTint } from './city-image'

describe('coverTint', () => {
  it('is deterministic for a given seed', () => {
    expect(coverTint('Lisbonne')).toBe(coverTint('Lisbonne'))
    expect(coverTint('Bali')).toBe(coverTint('Bali'))
  })

  it('returns a hex colour from the palette', () => {
    expect(coverTint('Lisbonne')).toMatch(/^#[0-9A-F]{6}$/i)
  })

  it('falls back to a stable default when the seed is missing', () => {
    expect(coverTint(undefined)).toBe(coverTint(undefined))
    expect(coverTint(undefined)).toMatch(/^#[0-9A-F]{6}$/i)
  })

  it('spreads different seeds across the palette', () => {
    const seeds = ['Lisbonne', 'Bali', 'Tokyo', 'Berlin', 'Paris', 'Oslo', 'Lima', 'Cairo']
    const distinct = new Set(seeds.map(coverTint))
    expect(distinct.size).toBeGreaterThan(1)
  })
})
