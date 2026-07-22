import { UnistylesRuntime } from 'react-native-unistyles'

import { openEncryptedMMKV } from './storage-encryption'

const storage = openEncryptedMMKV('zyph-preferences')

export type ThemePreference = 'system' | 'light' | 'dark'
export type LanguagePreference = 'system' | 'en' | 'fr'

const THEME_KEY = 'theme'
const LANGUAGE_KEY = 'language'
const ONBOARDING_KEY = 'onboardingSeen'
const PENDING_INVITE_KEY = 'pendingInvite'
const PENDING_SHARE_KEY = 'pendingShare'

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

// Dev-only: clears the flag so the onboarding pager can be replayed without reinstalling.
export function clearOnboardingSeen(): void {
  storage.remove(ONBOARDING_KEY)
}

// A trip invite code captured from a deep link while signed out, so the invitee can be sent to
// the join screen once they finish authenticating (the auth/onboarding redirect would otherwise
// discard the link's ?code= param).
export function getPendingInvite(): string | null {
  return storage.getString(PENDING_INVITE_KEY) ?? null
}

export function setPendingInvite(code: string): void {
  storage.set(PENDING_INVITE_KEY, code)
}

export function clearPendingInvite(): void {
  storage.remove(PENDING_INVITE_KEY)
}

// Text shared from another app (OS share sheet) while signed out, so it survives the sign-in
// redirect and can be replayed into Smart Import once the user authenticates (mirrors the pending
// invite above).
export function getPendingShare(): string | null {
  return storage.getString(PENDING_SHARE_KEY) ?? null
}

export function setPendingShare(text: string): void {
  storage.set(PENDING_SHARE_KEY, text)
}

export function clearPendingShare(): void {
  storage.remove(PENDING_SHARE_KEY)
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
