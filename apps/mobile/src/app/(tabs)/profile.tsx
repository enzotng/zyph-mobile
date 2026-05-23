import { Link } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { signOut, useAuth } from '@/features/auth'
import { useProfile } from '@/features/profile'
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/preferences'

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark']

export default function ProfileScreen() {
  const { session } = useAuth()
  const { data: profile } = useProfile()
  const [signingOut, setSigningOut] = useState(false)
  const [themePref, setThemePref] = useState<ThemePreference>(getThemePreference())

  function selectTheme(preference: ThemePreference) {
    setThemePref(preference)
    setThemePreference(preference)
  }

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
    <Screen title="Profile" showBack={false} scroll>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{profile?.display_name ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{session?.user.email ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Currency</Text>
          <Text style={styles.value}>{profile?.preferred_currency ?? '—'}</Text>
        </View>
      </View>

      <Link href="/profile/edit" style={styles.editLink}>
        Edit profile
      </Link>

      <Text style={styles.sectionTitle}>Theme</Text>
      <View style={styles.segment}>
        {THEME_OPTIONS.map((option) => (
          <Pressable
            key={option}
            style={[styles.segmentItem, themePref === option ? styles.segmentItemActive : null]}
            onPress={() => selectTheme(option)}
            accessibilityRole="button"
          >
            <Text
              style={[styles.segmentText, themePref === option ? styles.segmentTextActive : null]}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button label="Sign out" variant="secondary" onPress={onSignOut} disabled={signingOut} />
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.gap(4),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  label: {
    color: theme.colors.muted,
  },
  value: {
    color: theme.colors.foreground,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  segment: {
    flexDirection: 'row',
    gap: theme.gap(2),
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.gap(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  segmentItemActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    color: theme.colors.foreground,
    textTransform: 'capitalize',
  },
  segmentTextActive: {
    color: theme.colors.primaryForeground,
    fontWeight: '600',
  },
  editLink: {
    alignSelf: 'flex-start',
    color: theme.colors.primary,
    fontWeight: '600',
  },
}))
