import { toLang } from './lang'

describe('toLang', () => {
  it('keeps a supported language', () => {
    expect(toLang('en')).toBe('en')
    expect(toLang('fr')).toBe('fr')
  })

  it('ignores the region subtag', () => {
    expect(toLang('en-US')).toBe('en')
    expect(toLang('fr-CA')).toBe('fr')
    expect(toLang('fr_BE')).toBe('fr')
  })

  it('is case-insensitive', () => {
    expect(toLang('FR')).toBe('fr')
    expect(toLang('En-Gb')).toBe('en')
  })

  // The app falls back to English (lib/i18n resolveLanguage), so push copy must too - a device
  // that registered before push_tokens.locale existed has no locale at all.
  it('falls back to English when the locale is missing', () => {
    expect(toLang(null)).toBe('en')
    expect(toLang(undefined)).toBe('en')
    expect(toLang('')).toBe('en')
    expect(toLang('   ')).toBe('en')
  })

  it('falls back to English for a language the app does not ship', () => {
    expect(toLang('de')).toBe('en')
    expect(toLang('es-ES')).toBe('en')
    expect(toLang('zh-Hans-CN')).toBe('en')
  })
})
