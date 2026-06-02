import { createMMKV } from 'react-native-mmkv'
import { UnistylesRuntime } from 'react-native-unistyles'

// Plain (non-encrypted) store for non-sensitive app preferences.
const storage = createMMKV({ id: 'zyph-preferences' })

export type ThemePreference = 'system' | 'light' | 'dark'
export type LanguagePreference = 'system' | 'en' | 'fr'

const THEME_KEY = 'theme'
const LANGUAGE_KEY = 'language'
const ONBOARDING_KEY = 'onboardingSeen'

function shareLocationKey(tripId: string): string {
  return `shareLocation:${tripId}`
}

export function getShareLocation(tripId: string): boolean {
  return storage.getBoolean(shareLocationKey(tripId)) ?? false
}

export function setShareLocation(tripId: string, enabled: boolean): void {
  storage.set(shareLocationKey(tripId), enabled)
}

export function hasSeenOnboarding(): boolean {
  return storage.getBoolean(ONBOARDING_KEY) ?? false
}

export function setOnboardingSeen(): void {
  storage.set(ONBOARDING_KEY, true)
}

export function getThemePreference(): ThemePreference {
  const value = storage.getString(THEME_KEY)
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function setThemePreference(preference: ThemePreference): void {
  storage.set(THEME_KEY, preference)
  applyThemePreference(preference)
}

// 'system' follows the device locale; otherwise force the chosen language.
// Storage only - applying the language lives in lib/i18n to avoid an import cycle.
export function getLanguagePreference(): LanguagePreference {
  const value = storage.getString(LANGUAGE_KEY)
  return value === 'en' || value === 'fr' ? value : 'system'
}

export function setLanguagePreference(preference: LanguagePreference): void {
  storage.set(LANGUAGE_KEY, preference)
}

// 'system' follows the OS theme (adaptive); otherwise force the chosen theme.
export function applyThemePreference(preference: ThemePreference): void {
  if (preference === 'system') {
    UnistylesRuntime.setAdaptiveThemes(true)
  } else {
    UnistylesRuntime.setAdaptiveThemes(false)
    UnistylesRuntime.setTheme(preference)
  }
}
