import type { Session } from '@supabase/supabase-js'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { AuthProvider, useAuth } from '@/features/auth'

function useProtectedRoute(session: Session | null, isLoading: boolean) {
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) {
      return
    }
    const inAuthGroup = segments[0] === '(auth)'
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in')
    } else if (session && inAuthGroup) {
      router.replace('/')
    }
  }, [session, isLoading, segments, router])
}

function RootNavigator() {
  const { session, isLoading } = useAuth()
  useProtectedRoute(session, isLoading)

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    )
  }

  return <Slot />
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
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
