import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import { Avatar, ListRow, Segmented, Spinner, Surface } from '@/components/ui'
import { signOut, useAuth } from '@/features/auth'
import { useProfile } from '@/features/profile'
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/preferences'

export default function ProfileScreen() {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const router = useRouter()
  const { session } = useAuth()
  const { data: profile, isLoading, isError, refetch } = useProfile()
  const [signingOut, setSigningOut] = useState(false)
  const [themePref, setThemePref] = useState<ThemePreference>(getThemePreference())

  const themeOptions = [
    { value: 'system', label: t('profile.theme.system') },
    { value: 'light', label: t('profile.theme.light') },
    { value: 'dark', label: t('profile.theme.dark') },
  ]

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
        t('profile.signOutErrorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    } finally {
      setSigningOut(false)
    }
  }

  const displayName = profile?.display_name ?? t('profile.fallbackName')
  const email = session?.user.email ?? '-'
  const currency = profile?.preferred_currency ?? 'EUR'

  if (isLoading && !profile) {
    return (
      <Screen title={t('profile.title')} showBack={false}>
        <View style={styles.statusCenter}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (isError && !profile) {
    return (
      <Screen title={t('profile.title')} showBack={false}>
        <View style={styles.statusCenter}>
          <Button label={t('common.tryAgain')} variant="secondary" onPress={() => void refetch()} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title={t('profile.title')} showBack={false} scroll>
      {/* Profile header */}
      <Pressable
        onPress={() => router.push('/profile/edit')}
        style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('profile.editProfile')}
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
        <Text style={styles.groupTitle}>{t('profile.section.account')}</Text>
        <Surface
          color={theme.colors.card}
          borderColor={theme.colors.border}
          borderWidth={1}
          radius={theme.radius.lg}
          style={styles.groupCard}
        >
          <ListRow
            icon="person-outline"
            title={t('profile.displayName')}
            detail={displayName}
            onPress={() => router.push('/profile/edit')}
          />
          <ListRow
            icon="cash-outline"
            iconColor={theme.colors.success}
            title={t('profile.defaultCurrency')}
            detail={currency}
            onPress={() => router.push('/profile/edit')}
          />
          <ListRow
            icon="notifications-outline"
            iconColor={theme.colors.warning}
            title={t('profile.notifications')}
            detail={t('profile.notificationsOn')}
            last
          />
        </Surface>
      </View>

      {/* Appearance */}
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{t('profile.section.appearance')}</Text>
        <Segmented value={themePref} onChange={selectTheme} options={themeOptions} />
        <Text style={styles.groupHint}>{t('profile.appearanceHint')}</Text>
      </View>

      <Button
        label={t('profile.signOut')}
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
  statusCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(3),
  },
  spacer: {
    height: FLOATING_TAB_BAR_CLEARANCE,
  },
}))
