import { Ionicons } from '@expo/vector-icons'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Spinner } from '@/components/ui'
import { withAlpha } from '@/lib/color'

// Landing route for the zyph://auth/callback deep link (email confirmation, password recovery).
// On success the URL carries a ?code= which the global handler (use-auth) exchanges, and the
// auth guard then routes away (home, or reset-password for a recovery link) - we show a loader.
// On failure Supabase redirects here with ?error= (e.g. an expired/used link) - we show a clear
// message instead of expo-router's bare "Unmatched Route".
export default function AuthCallbackScreen() {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const router = useRouter()
  const params = useLocalSearchParams<{ error?: string; error_code?: string }>()
  const hasError = typeof params.error === 'string'

  // Safety net: if a ?code= exchange neither signs us in nor errors (rare), don't spin forever.
  useEffect(() => {
    if (hasError) {
      return
    }
    const timer = setTimeout(() => router.replace('/(auth)/sign-in'), 6000)
    return () => clearTimeout(timer)
  }, [hasError, router])

  if (!hasError) {
    return (
      <View style={styles.center}>
        <Spinner label={t('common.loading')} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: withAlpha(theme.colors.warning, 0.12) }]}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.colors.warning} />
      </View>

      <Text style={styles.title}>{t('auth.callback.errorTitle')}</Text>
      <Text style={styles.body}>{t('auth.callback.errorBody')}</Text>

      <View style={styles.action}>
        <Button
          label={t('auth.callback.requestNew')}
          icon="mail-outline"
          onPress={() => router.replace('/(auth)/forgot-password')}
        />
      </View>

      <Link href="/(auth)/sign-in" style={styles.link}>
        {t('auth.checkEmail.backToSignIn')}
      </Link>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(3.5),
    paddingHorizontal: theme.gap(8),
    paddingTop: rt.insets.top,
    backgroundColor: theme.colors.background,
  },
  iconCircle: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  body: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 300,
  },
  action: {
    alignSelf: 'stretch',
    maxWidth: 320,
    marginTop: theme.gap(1),
  },
  link: {
    fontFamily: theme.fonts.sans.semibold,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    fontWeight: '600',
  },
}))
