import type { Session } from '@supabase/supabase-js'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useFonts } from 'expo-font'
import { Stack, useGlobalSearchParams, useRouter, useSegments } from 'expo-router'
import { ShareIntentProvider } from 'expo-share-intent'
import { useEffect } from 'react'
import { Platform, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider, KeyboardToolbar } from 'react-native-keyboard-controller'
import { StyleSheet } from 'react-native-unistyles'

import { ErrorBoundary } from '@/components/error-boundary'
import { OfflineBanner } from '@/components/offline-banner'
import { ShareIntentRouter } from '@/components/share-intent-router'
import { Spinner } from '@/components/ui'
import { AuthProvider, useAuth } from '@/features/auth'
import { usePushNotificationResponder } from '@/features/notifications'
import '@/lib/i18n'
import '@/lib/online-manager'
import {
  clearPendingInvite,
  clearPendingShare,
  getPendingInvite,
  getPendingShare,
  hasSeenOnboarding,
  setPendingInvite,
} from '@/lib/preferences'
import { queryClient } from '@/lib/query-client'
import { mmkvQueryPersister } from '@/lib/query-persister'
import { paramString } from '@/lib/routing'

function useProtectedRoute(session: Session | null, isLoading: boolean, recovering: boolean) {
  const segments = useSegments()
  const router = useRouter()
  const params = useGlobalSearchParams<{ code?: string }>()

  useEffect(() => {
    if (isLoading) {
      return
    }
    const seg0 = segments[0] as string
    // An invite arrives as a deep link (zyph://trips/join?code=...). A signed-out or first-time
    // invitee is about to be bounced to onboarding/sign-in, which discards the link's ?code= -
    // so stash it now and route to the join screen once they are authenticated.
    const onJoin = seg0 === 'trips' && (segments as string[])[1] === 'join'
    const inviteCode = paramString(params.code)
    if (onJoin && !session && inviteCode) {
      setPendingInvite(inviteCode)
    }

    // Where a freshly-authenticated user should land: a pending invite -> the join screen (which
    // auto-joins from the code), otherwise home.
    const redirectAuthed = () => {
      const pending = getPendingInvite()
      if (pending) {
        clearPendingInvite()
        router.replace({ pathname: '/trips/join', params: { code: pending } })
        return
      }
      // A booking shared while signed out (stashed by ShareIntentRouter) -> replay it now.
      const pendingShare = getPendingShare()
      if (pendingShare) {
        clearPendingShare()
        router.replace({ pathname: '/share-handler', params: { text: pendingShare } })
        return
      }
      router.replace('/')
    }

    const inOnboarding = seg0 === 'onboarding'
    if (!hasSeenOnboarding()) {
      if (!inOnboarding) {
        router.replace('/onboarding')
      }
      return
    }
    // A recovery session must land on reset-password, before the normal session routing -
    // otherwise the session would bounce it straight to home.
    if (recovering) {
      // Cast: with expo-router typed routes useSegments() is a tuple union (some routes are
      // length 1), so index [1] must be read off a widened string[].
      const onReset = segments[0] === '(auth)' && (segments as string[])[1] === 'reset-password'
      if (!onReset) {
        router.replace('/(auth)/reset-password')
      }
      return
    }
    // `auth` is the deep-link callback route (zyph://auth/callback); treat it like the auth
    // group so an unauthenticated error-callback isn't bounced before it can show its message.
    const inAuthGroup = seg0 === '(auth)' || seg0 === 'auth'
    if (inOnboarding) {
      if (session) {
        redirectAuthed()
      } else {
        router.replace('/(auth)/sign-in')
      }
    } else if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in')
    } else if (session && inAuthGroup) {
      redirectAuthed()
    }
  }, [session, isLoading, recovering, segments, router, params.code])
}

// Vendored brand fonts (.ttf in assets/fonts). Keys must match theme.fonts.* in unistyles.ts.
const BRAND_FONTS = {
  SpaceGrotesk_400Regular: require('../../assets/fonts/SpaceGrotesk_400Regular.ttf'),
  SpaceGrotesk_500Medium: require('../../assets/fonts/SpaceGrotesk_500Medium.ttf'),
  SpaceGrotesk_600SemiBold: require('../../assets/fonts/SpaceGrotesk_600SemiBold.ttf'),
  SpaceGrotesk_700Bold: require('../../assets/fonts/SpaceGrotesk_700Bold.ttf'),
  PlusJakartaSans_400Regular: require('../../assets/fonts/PlusJakartaSans_400Regular.ttf'),
  PlusJakartaSans_500Medium: require('../../assets/fonts/PlusJakartaSans_500Medium.ttf'),
  PlusJakartaSans_600SemiBold: require('../../assets/fonts/PlusJakartaSans_600SemiBold.ttf'),
  PlusJakartaSans_700Bold: require('../../assets/fonts/PlusJakartaSans_700Bold.ttf'),
}

// The keyboard nav toolbar (prev/next/done) only helps on multi-input forms; hide it on the Zo
// chat, which has a single composer input so the prev/next arrows have nowhere to go.
function GlobalKeyboardToolbar() {
  const segments = useSegments()
  if ((segments as string[]).includes('copilot')) {
    return null
  }
  return <KeyboardToolbar />
}

function RootNavigator() {
  const { session, isLoading, recovering } = useAuth()
  const [fontsLoaded] = useFonts(BRAND_FONTS)
  useProtectedRoute(session, isLoading, recovering)
  // Deep-link a tapped lock-screen push once the user is signed in.
  usePushNotificationResponder(Boolean(session))

  if (isLoading || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <Spinner />
      </View>
    )
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <ShareIntentRouter />
      <GlobalKeyboardToolbar />
    </>
  )
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <KeyboardProvider>
          <ShareIntentProvider
            options={{ debug: false, resetOnBackground: true, disabled: Platform.OS === 'web' }}
          >
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister: mmkvQueryPersister,
                // Drop cached data older than 7 days; bump the buster to invalidate on a shape change.
                maxAge: 1000 * 60 * 60 * 24 * 7,
                buster: 'v1',
              }}
            >
              <AuthProvider>
                <RootNavigator />
                <OfflineBanner />
              </AuthProvider>
            </PersistQueryClientProvider>
          </ShareIntentProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create((theme) => ({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  root: {
    flex: 1,
  },
}))
