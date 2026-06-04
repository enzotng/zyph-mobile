import type { Session } from '@supabase/supabase-js'
import { QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import { Stack, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Spinner } from '@/components/ui'
import { AuthProvider, useAuth } from '@/features/auth'
import '@/lib/i18n'
import { hasSeenOnboarding } from '@/lib/preferences'
import { queryClient } from '@/lib/query-client'

function useProtectedRoute(session: Session | null, isLoading: boolean) {
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) {
      return
    }
    const inOnboarding = segments[0] === 'onboarding'
    if (!hasSeenOnboarding()) {
      if (!inOnboarding) {
        router.replace('/onboarding')
      }
      return
    }
    const inAuthGroup = segments[0] === '(auth)'
    if (inOnboarding) {
      router.replace(session ? '/' : '/(auth)/sign-in')
    } else if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in')
    } else if (session && inAuthGroup) {
      router.replace('/')
    }
  }, [session, isLoading, segments, router])
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

function RootNavigator() {
  const { session, isLoading } = useAuth()
  const [fontsLoaded] = useFonts(BRAND_FONTS)
  useProtectedRoute(session, isLoading)

  if (isLoading || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <Spinner />
      </View>
    )
  }

  return <Stack screenOptions={{ headerShown: false }} />
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create((theme) => ({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
}))
