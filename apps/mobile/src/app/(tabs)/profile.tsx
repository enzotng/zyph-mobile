import { Link } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import { Squircle } from '@/components/ui'
import { signOut, useAuth } from '@/features/auth'
import { useProfile } from '@/features/profile'
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/preferences'

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark']

export default function ProfileScreen() {
  const { theme } = useUnistyles()
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
      <Squircle
        color={theme.colors.card}
        borderColor={theme.colors.border}
        borderWidth={1}
        radius={theme.radius.lg}
        style={styles.card}
      >
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{profile?.display_name ?? '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{session?.user.email ?? '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Currency</Text>
          <Text style={styles.value}>{profile?.preferred_currency ?? '-'}</Text>
        </View>
      </Squircle>

      <Link href="/profile/edit" style={styles.editLink}>
        Edit profile
      </Link>

      {/* Dev-only entry to preview the UI kit; inert in production builds. */}
      {__DEV__ ? (
        <Link href="/ui-kit" style={styles.editLink}>
          UI kit (dev)
        </Link>
      ) : null}

      <Text style={styles.sectionTitle}>Theme</Text>
      <View style={styles.segment}>
        {THEME_OPTIONS.map((option) => (
          <Pressable
            key={option}
            style={styles.segmentItemWrapper}
            onPress={() => selectTheme(option)}
            accessibilityRole="button"
          >
            <Squircle
              color={themePref === option ? theme.colors.primary : theme.colors.card}
              borderColor={themePref === option ? theme.colors.primary : theme.colors.border}
              borderWidth={1}
              radius={theme.radius.md}
              style={styles.segmentItem}
            >
              <Text
                style={[styles.segmentText, themePref === option ? styles.segmentTextActive : null]}
              >
                {option}
              </Text>
            </Squircle>
          </Pressable>
        ))}
      </View>

      <Button label="Sign out" variant="secondary" onPress={onSignOut} disabled={signingOut} />

      <View style={styles.spacer} />
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  card: {
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
  segmentItemWrapper: {
    flex: 1,
  },
  segmentItem: {
    alignItems: 'center',
    paddingVertical: theme.gap(3),
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
  spacer: {
    height: FLOATING_TAB_BAR_CLEARANCE,
  },
}))
