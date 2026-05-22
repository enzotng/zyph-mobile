import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { signOut, useAuth } from '@/features/auth'

export default function HomeScreen() {
  const { session } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  async function onSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      Alert.alert('Sign out failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ZYPH</Text>
      <Text style={styles.subtitle}>{session?.user.email ?? 'Offline-first travel'}</Text>
      <Button label="Sign out" variant="secondary" onPress={onSignOut} disabled={signingOut} />
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(3),
    paddingTop: rt.insets.top,
    paddingHorizontal: theme.gap(6),
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
}))
