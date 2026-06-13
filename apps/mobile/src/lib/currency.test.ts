import { currencyFlag, currencyName } from './currency'

describe('currencyFlag', () => {
  it('builds a regional-indicator flag from the first two letters', () => {
    expect(currencyFlag('USD')).toBe('🇺🇸')
    expect(currencyFlag('EUR')).toBe('🇪🇺')
    expect(currencyFlag('CAD')).toBe('🇨🇦')
    expect(currencyFlag('jpy')).toBe('🇯🇵')
  })

  it('falls back for supranational / non-country / malformed codes', () => {
    expect(currencyFlag('XOF')).toBe('💱')
    expect(currencyFlag('XAU')).toBe('💱')
    expect(currencyFlag('')).toBe('💱')
    expect(currencyFlag('E')).toBe('💱')
  })
})

describe('currencyName', () => {
  it('resolves a localized name', () => {
    expect(currencyName('EUR', 'en').toLowerCase()).toContain('euro')
    expect(currencyName('USD', 'en').toLowerCase()).toContain('dollar')
  })

  it('falls back to the code for an unknown currency', () => {
    expect(currencyName('QQQ', 'en')).toBe('QQQ')
  })
})
