import * as Localization from 'expo-localization'

import { setLanguagePreference } from '@/lib/preferences'

import i18n, { resolveLanguage, syncSystemLanguageOnForeground } from './index'

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}))

const getLocales = Localization.getLocales as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  getLocales.mockReturnValue([{ languageCode: 'en' }])
})

describe('resolveLanguage', () => {
  it('returns the explicit preference when it is not "system"', () => {
    expect(resolveLanguage('en')).toBe('en')
    expect(resolveLanguage('fr')).toBe('fr')
  })

  it('follows the device locale in "system" mode', () => {
    getLocales.mockReturnValue([{ languageCode: 'fr' }])
    expect(resolveLanguage('system')).toBe('fr')
  })

  it('falls back to English for an unsupported device locale', () => {
    getLocales.mockReturnValue([{ languageCode: 'de' }])
    expect(resolveLanguage('system')).toBe('en')
  })

  it('falls back to English when no device locale is available', () => {
    getLocales.mockReturnValue([])
    expect(resolveLanguage('system')).toBe('en')
  })
})

describe('syncSystemLanguageOnForeground', () => {
  let changeLanguage: jest.SpyInstance

  beforeEach(async () => {
    await i18n.changeLanguage('en')
    changeLanguage = jest.spyOn(i18n, 'changeLanguage')
  })

  afterEach(() => {
    changeLanguage.mockRestore()
  })

  it('re-resolves to the OS language on foreground in system mode', () => {
    setLanguagePreference('system')
    getLocales.mockReturnValue([{ languageCode: 'fr' }])

    syncSystemLanguageOnForeground('active')

    expect(changeLanguage).toHaveBeenCalledWith('fr')
  })

  it('does nothing when the app is not active', () => {
    setLanguagePreference('system')
    getLocales.mockReturnValue([{ languageCode: 'fr' }])

    syncSystemLanguageOnForeground('background')

    expect(changeLanguage).not.toHaveBeenCalled()
  })

  it('does nothing when the preference is an explicit language', () => {
    setLanguagePreference('en')
    getLocales.mockReturnValue([{ languageCode: 'fr' }])

    syncSystemLanguageOnForeground('active')

    expect(changeLanguage).not.toHaveBeenCalled()
  })

  it('does not re-apply when the resolved language is unchanged', () => {
    setLanguagePreference('system')
    getLocales.mockReturnValue([{ languageCode: 'en' }])

    syncSystemLanguageOnForeground('active')

    expect(changeLanguage).not.toHaveBeenCalled()
  })
})
