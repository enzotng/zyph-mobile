import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

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
    await registerPushToken(token, currentPlatform())
    // Only remember the token once it is actually saved, so sign-out never tries to delete a token
    // that never made it to the DB.
    lastToken = token
  } catch {
    // Offline / no permission / dev build without the push entitlement -> push stays off.
  }
}

// Removes this device's token on sign-out (called while still authenticated). Best-effort.
export async function unregisterForPushNotifications(): Promise<void> {
  if (!lastToken) {
    return
  }
  try {
    await deletePushToken(lastToken)
  } catch {
    // Network/RLS hiccup: the token is reassigned on the next sign-in anyway.
  }
  lastToken = null
}
