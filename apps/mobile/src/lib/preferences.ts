import { createMMKV } from 'react-native-mmkv'
import { UnistylesRuntime } from 'react-native-unistyles'

// Plain (non-encrypted) store for non-sensitive app preferences.
const storage = createMMKV({ id: 'zyph-preferences' })

export type ThemePreference = 'system' | 'light' | 'dark'

const THEME_KEY = 'theme'
const ONBOARDING_KEY = 'onboardingSeen'

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

// 'system' follows the OS theme (adaptive); otherwise force the chosen theme.
export function applyThemePreference(preference: ThemePreference): void {
  if (preference === 'system') {
    UnistylesRuntime.setAdaptiveThemes(true)
  } else {
    UnistylesRuntime.setAdaptiveThemes(false)
    UnistylesRuntime.setTheme(preference)
  }
}
