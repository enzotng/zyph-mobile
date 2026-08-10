import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import i18n from '@/lib/i18n'

import { deletePushToken, type PushPlatform, registerPushToken } from './api/notifications.api'

// Show incoming pushes while the app is foregrounded too (banner + sound), matching the in-app feed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// The token last registered on this device, so sign-out can remove exactly it (not other devices).
let lastToken: string | null = null
// The locale stored alongside it. i18next emits languageChanged even when the language is
// unchanged (picking the already-selected entry, or "system" when it resolves the same), so
// without this the picker would fire a redundant RPC on every tap.
let lastLocale: string | null = null

function currentPlatform(): PushPlatform {
  if (Platform.OS === 'ios') {
    return 'ios'
  }
  if (Platform.OS === 'android') {
    return 'android'
  }
  return 'web'
}

// Resolves the EAS project id (required by Expo's push service), set by `eas init` in app.json.
function easProjectId(): string | null {
  const fromConfig = Constants.expoConfig?.extra?.eas?.projectId
  const fromEas = Constants.easConfig?.projectId
  return (typeof fromConfig === 'string' && fromConfig) || (typeof fromEas === 'string' && fromEas)
    ? ((fromConfig || fromEas) as string)
    : null
}

// Asks for notification permission (once granted, no prompt) and registers this device's Expo push
// token to the signed-in user. Best-effort: a simulator, a denied permission, a non-push build or
// being offline all just leave push off without surfacing an error. Safe to call on every sign-in.
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    return
  }
  try {
    const existing = await Notifications.getPermissionsAsync()
    let status = existing.status
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync()
      status = requested.status
    }
    if (status !== 'granted') {
      return
    }
    const projectId = easProjectId()
    if (!projectId) {
      return
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    // Read the language ONCE: if it changes during the round-trip, lastLocale must record what the
    // database actually received, or the listener's guard would take the column for up to date and
    // never send the correction.
    const locale = i18n.language
    await registerPushToken(token, currentPlatform(), locale)
    // Only remember the token once it is actually saved, so sign-out never tries to delete a token
    // that never made it to the DB.
    lastToken = token
    lastLocale = locale
  } catch {
    // Offline / no permission / dev build without the push entitlement -> push stays off.
  }
}

// Push copy is rendered server-side from push_tokens.locale, so that column has to follow the app
// instead of staying frozen at whatever the language was when the token was registered. Hooking
// i18next covers both ways the language can change (the settings picker and an OS-level change
// picked up on foreground), since both go through changeLanguage.
i18n.on('languageChanged', (language: string) => {
  if (!lastToken || language === lastLocale) {
    return
  }
  lastLocale = language
  // Best-effort, and the token itself is unchanged - only the locale column needs rewriting.
  // Forget the locale again on failure so the next change retries; a persistent failure is
  // corrected by the re-register on the next sign-in.
  void registerPushToken(lastToken, currentPlatform(), language).catch(() => {
    lastLocale = null
  })
})

// Removes this device's token on sign-out (called while still authenticated). Best-effort.
export async function unregisterForPushNotifications(): Promise<void> {
  const token = lastToken
  if (!token) {
    return
  }
  // Forget the token BEFORE the await: a language change landing mid-delete would otherwise
  // re-register the very token being removed, leaving a signed-out device still receiving pushes.
  lastToken = null
  lastLocale = null
  try {
    await deletePushToken(token)
  } catch {
    // Network/RLS hiccup: the token is reassigned on the next sign-in anyway.
  }
}
