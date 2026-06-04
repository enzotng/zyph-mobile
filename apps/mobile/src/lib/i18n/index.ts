// The default i18next export IS the instance; `.use`/`.changeLanguage` on it are intended.
/* eslint-disable import/no-named-as-default-member */
import { getLocales } from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import {
  getLanguagePreference,
  type LanguagePreference,
  setLanguagePreference,
} from '@/lib/preferences'

import { en } from './locales/en'
import { fr } from './locales/fr'

export type AppLanguage = 'en' | 'fr'
export const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'fr']
const DEFAULT_LANGUAGE: AppLanguage = 'en'

const resources = {
  en: { translation: en },
  fr: { translation: fr },
} as const

// Resolve the active language: an explicit preference wins, otherwise follow
// the device locale, falling back to English for any unsupported locale.
function resolveLanguage(preference: LanguagePreference): AppLanguage {
  if (preference !== 'system') {
    return preference
  }
  const deviceCode = getLocales()[0]?.languageCode
  return (SUPPORTED_LANGUAGES as string[]).includes(deviceCode ?? '')
    ? (deviceCode as AppLanguage)
    : DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(getLanguagePreference()),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false },
  returnNull: false,
})

// Persist the chosen language and apply it immediately.
export function setAppLanguage(preference: LanguagePreference): void {
  setLanguagePreference(preference)
  void i18n.changeLanguage(resolveLanguage(preference))
}

export default i18n
