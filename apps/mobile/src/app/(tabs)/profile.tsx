import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Linking, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { APP_TAB_BAR_CLEARANCE } from '@/components/layout/app-tab-bar'
import { Screen } from '@/components/screen'
import { Avatar, Eyebrow, ListRow, Segmented, Spinner, Surface } from '@/components/ui'
import { signOut, useAuth } from '@/features/auth'
import { ACCOUNT_HAS_SHARED_TRIPS, deleteAccount, useProfile } from '@/features/profile'
import { setAppLanguage } from '@/lib/i18n'
import {
  getLanguagePreference,
  getThemePreference,
  type LanguagePreference,
  setThemePreference,
  type ThemePreference,
} from '@/lib/preferences'

export default function ProfileScreen() {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const router = useRouter()
  const { session } = useAuth()
  const { data: profile, isLoading, isError, refetch } = useProfile()
  const [signingOut, setSigningOut] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [themePref, setThemePref] = useState<ThemePreference>(getThemePreference())
  const [langPref, setLangPref] = useState<LanguagePreference>(getLanguagePreference())

  const themeOptions = [
    { value: 'system', label: t('profile.theme.system') },
    { value: 'light', label: t('profile.theme.light') },
    { value: 'dark', label: t('profile.theme.dark') },
  ]

  // FR/EN are shown as autonyms (their own name) so each is recognisable whatever the current UI
  // language; only "System" is translated.
  const languageOptions = [
    { value: 'system', label: t('profile.language.system') },
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
  ]

  function selectTheme(value: string) {
    const preference = value as ThemePreference
    setThemePref(preference)
    setThemePreference(preference)
  }

  function selectLanguage(value: string) {
    const preference = value as LanguagePreference
    setLangPref(preference)
    setAppLanguage(preference)
  }

  // Opens the OS settings page for the app, where iOS/Android expose the native per-app language.
  function openSystemLanguageSettings() {
    void Linking.openSettings()
  }

  // Opens the hosted legal pages (privacy policy + terms) in an in-app browser.
  function openLegal() {
    void WebBrowser.openBrowserAsync('https://enzotng.github.io/zyph-mobile/')
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

  function confirmDeleteAccount() {
    Alert.alert(t('profile.deleteAccountConfirmTitle'), t('profile.deleteAccountConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccount'),
        style: 'destructive',
        onPress: () => void onDeleteAccount(),
      },
    ])
  }

  async function onDeleteAccount() {
    setDeleting(true)
    try {
      await deleteAccount()
      // The server session is now invalidated; drop the local one to return to the auth flow.
      await signOut().catch(() => undefined)
    } catch (error) {
      const message =
        error instanceof Error && error.message === ACCOUNT_HAS_SHARED_TRIPS
          ? t('profile.deleteAccountBlocked')
          : error instanceof Error
            ? error.message
            : t('common.tryAgain')
      Alert.alert(t('profile.deleteAccountErrorTitle'), message)
      setDeleting(false)
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
        <Avatar
          name={displayName}
          imageUrl={profile?.avatar_url}
          size={60}
          tint={theme.colors.primary}
        />
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
        <Eyebrow>{t('profile.section.account')}</Eyebrow>
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
            onPress={() => router.push('/profile/notifications')}
          />
          <ListRow
            icon="lock-closed-outline"
            title={t('profile.changePassword')}
            onPress={() => router.push('/profile/change-password')}
            last
          />
        </Surface>
      </View>

      {/* Appearance */}
      <View style={styles.group}>
        <Eyebrow>{t('profile.section.appearance')}</Eyebrow>
        <Segmented value={themePref} onChange={selectTheme} options={themeOptions} />
        <Text style={styles.groupHint}>{t('profile.appearanceHint')}</Text>
      </View>

      {/* Language */}
      <View style={styles.group}>
        <Eyebrow>{t('profile.section.language')}</Eyebrow>
        <Segmented value={langPref} onChange={selectLanguage} options={languageOptions} />
        <Surface
          color={theme.colors.card}
          borderColor={theme.colors.border}
          borderWidth={1}
          radius={theme.radius.lg}
          style={styles.groupCard}
        >
          <ListRow
            icon="language-outline"
            title={t('profile.openSystemLanguage')}
            onPress={openSystemLanguageSettings}
            last
          />
        </Surface>
        <Text style={styles.groupHint}>{t('profile.languageHint')}</Text>
      </View>

      {/* About / legal */}
      <View style={styles.group}>
        <Eyebrow>{t('profile.section.about')}</Eyebrow>
        <Surface
          color={theme.colors.card}
          borderColor={theme.colors.border}
          borderWidth={1}
          radius={theme.radius.lg}
          style={styles.groupCard}
        >
          <ListRow
            icon="document-text-outline"
            title={t('profile.legal')}
            onPress={openLegal}
            last
          />
        </Surface>
      </View>

      <Button
        label={t('profile.signOut')}
        variant="destructive"
        icon="log-out-outline"
        onPress={onSignOut}
        disabled={signingOut || deleting}
      />

      <Pressable
        onPress={confirmDeleteAccount}
        disabled={deleting}
        accessibilityRole="button"
        accessibilityLabel={t('profile.deleteAccount')}
        style={({ pressed }) => [
          styles.dangerLink,
          pressed && styles.pressed,
          deleting && styles.dangerLinkDisabled,
        ]}
      >
        <Text style={styles.dangerLinkText}>{t('profile.deleteAccount')}</Text>
      </Pressable>

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
  groupCard: {
    paddingHorizontal: theme.gap(4),
  },
  groupHint: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
    paddingLeft: 2,
  },
  dangerLink: {
    alignItems: 'center',
    paddingVertical: theme.gap(2),
  },
  dangerLinkText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
  },
  dangerLinkDisabled: {
    opacity: 0.5,
  },
  statusCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(3),
  },
  spacer: {
    height: APP_TAB_BAR_CLEARANCE,
  },
}))
