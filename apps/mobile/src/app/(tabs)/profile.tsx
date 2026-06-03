import { Ionicons } from '@expo/vector-icons'
import { Link, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import { Avatar, ListRow, Segmented, Squircle } from '@/components/ui'
import { signOut, useAuth } from '@/features/auth'
import { useProfile } from '@/features/profile'
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/preferences'

const THEME_OPTIONS = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
] as const

export default function ProfileScreen() {
  const { theme } = useUnistyles()
  const router = useRouter()
  const { session } = useAuth()
  const { data: profile } = useProfile()
  const [signingOut, setSigningOut] = useState(false)
  const [themePref, setThemePref] = useState<ThemePreference>(getThemePreference())

  function selectTheme(value: string) {
    const preference = value as ThemePreference
    setThemePref(preference)
    setThemePreference(preference)
  }

  async function onSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      Alert.alert(
        'Déconnexion impossible',
        error instanceof Error ? error.message : 'Veuillez réessayer.',
      )
    } finally {
      setSigningOut(false)
    }
  }

  const displayName = profile?.display_name ?? 'Mon profil'
  const email = session?.user.email ?? '-'
  const currency = profile?.preferred_currency ?? 'EUR'

  return (
    <Screen title="Profil" showBack={false} scroll>
      {/* Profile header */}
      <Pressable
        onPress={() => router.push('/profile/edit')}
        style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Modifier le profil"
      >
        <Avatar name={displayName} size={60} tint={theme.colors.primary} />
        <View style={styles.heroInfo}>
          <Text style={styles.heroName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.heroEmail} numberOfLines={1}>
            {email}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
      </Pressable>

      {/* Account */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>Compte</Text>
        <Squircle
          color={theme.colors.card}
          borderColor={theme.colors.border}
          borderWidth={1}
          radius={theme.radius.lg}
          style={styles.groupCard}
        >
          <ListRow
            icon="person-outline"
            title="Nom affiché"
            detail={displayName}
            onPress={() => router.push('/profile/edit')}
          />
          <ListRow
            icon="cash-outline"
            iconColor={theme.colors.success}
            title="Devise par défaut"
            detail={currency}
            onPress={() => router.push('/profile/edit')}
          />
          <ListRow
            icon="notifications-outline"
            iconColor={theme.colors.warning}
            title="Notifications"
            detail="Activées"
            last
          />
        </Squircle>
      </View>

      {/* Appearance */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>Apparence</Text>
        <Segmented value={themePref} onChange={selectTheme} options={[...THEME_OPTIONS]} />
        <Text style={styles.groupHint}>
          « Système » suit le réglage clair/sombre de l’appareil.
        </Text>
      </View>

      {/* Dev-only entry to preview the UI kit; inert in production builds. */}
      {__DEV__ ? (
        <Link href="/ui-kit" style={styles.devLink}>
          UI kit (dev)
        </Link>
      ) : null}

      <Button
        label="Se déconnecter"
        variant="destructive"
        icon="log-out-outline"
        onPress={onSignOut}
        disabled={signingOut}
      />

      <View style={styles.spacer} />
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3.5),
  },
  pressed: {
    opacity: 0.85,
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xl,
    color: theme.colors.foreground,
  },
  heroEmail: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 2,
  },
  group: {
    gap: theme.gap(2),
  },
  groupTitle: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  groupCard: {
    paddingHorizontal: theme.gap(4),
  },
  groupHint: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
    paddingLeft: 2,
  },
  devLink: {
    alignSelf: 'flex-start',
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
  },
  spacer: {
    height: FLOATING_TAB_BAR_CLEARANCE,
  },
}))
