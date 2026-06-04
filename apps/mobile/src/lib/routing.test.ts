import { paramString } from './routing'

describe('paramString', () => {
  it('returns the string value when given a string', () => {
    expect(paramString('trip-123')).toBe('trip-123')
  })

  it('returns the first element when given an array', () => {
    expect(paramString(['first', 'second'])).toBe('first')
  })

  it('defaults to an empty string when the value is undefined', () => {
    expect(paramString(undefined)).toBe('')
  })

  it('defaults to an empty string for an empty array', () => {
    expect(paramString([])).toBe('')
  })

  it('preserves an empty string value', () => {
    expect(paramString('')).toBe('')
  })
})
