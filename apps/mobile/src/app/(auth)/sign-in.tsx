import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { ZyphMark } from '@/components/brand/zyph-mark'
import { Button } from '@/components/button'
import { TextField } from '@/components/text-field'
import {
  AppleButton,
  makeSignInSchema,
  type SignInValues,
  signIn,
  signInWithApple,
  signInWithGoogle,
} from '@/features/auth'

export default function SignInScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [appleSubmitting, setAppleSubmitting] = useState(false)
  const busy = submitting || googleSubmitting || appleSubmitting
  const schema = useMemo(() => makeSignInSchema(t), [t])
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: SignInValues) {
    setSubmitting(true)
    try {
      await signIn(values)
      // La navigation est gérée par la garde d'authentification après la mise à jour de la session.
    } catch (error) {
      Alert.alert(
        t('auth.signIn.errorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function onGoogle() {
    setGoogleSubmitting(true)
    try {
      await signInWithGoogle()
      // The auth guard navigates once the session updates.
    } catch (error) {
      Alert.alert(
        t('auth.google.errorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    } finally {
      setGoogleSubmitting(false)
    }
  }

  async function onApple() {
    setAppleSubmitting(true)
    try {
      await signInWithApple()
      // The auth guard navigates once the session updates.
    } catch (error) {
      Alert.alert(
        t('auth.apple.errorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    } finally {
      setAppleSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <BrandLockup />

      <View style={styles.heading}>
        <Text style={styles.title}>{t('auth.signIn.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.signIn.subtitle')}</Text>
      </View>

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label={t('auth.fields.email')}
            placeholder={t('auth.fields.emailPlaceholder')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label={t('auth.fields.password')}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="current-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
          />
        )}
      />

      <Pressable
        onPress={() => router.push('/(auth)/forgot-password')}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.forgot}
      >
        <Text style={styles.forgotText}>{t('auth.signIn.forgotPassword')}</Text>
      </Pressable>

      <View style={styles.action}>
        <Button
          label={submitting ? t('auth.signIn.submitting') : t('auth.signIn.submit')}
          onPress={handleSubmit(onSubmit)}
          disabled={busy}
        />
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('auth.orSeparator')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.social}>
        <Button
          variant="secondary"
          icon="logo-google"
          label={googleSubmitting ? t('auth.google.signingIn') : t('auth.google.continue')}
          onPress={onGoogle}
          disabled={busy}
        />
        <AppleButton onPress={onApple} disabled={busy} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.muted}>{t('auth.signIn.noAccount')}</Text>
        <Link href="/(auth)/sign-up" style={styles.link}>
          {t('auth.signIn.createAccount')}
        </Link>
      </View>
    </View>
  )
}

function BrandLockup() {
  const { theme } = useUnistyles()
  return (
    <View style={styles.lockup}>
      <ZyphMark size={26} />
      <Text style={[styles.wordmark, { color: theme.colors.foreground }]}>ZYPH</Text>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.gap(4),
    paddingHorizontal: theme.gap(6),
    paddingTop: rt.insets.top,
    backgroundColor: theme.colors.background,
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  wordmark: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: 22,
    letterSpacing: -0.6,
  },
  heading: {
    gap: theme.gap(1.5),
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xl,
    color: theme.colors.foreground,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  forgot: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontFamily: theme.fonts.sans.semibold,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  action: {
    marginTop: theme.gap(1),
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  social: {
    gap: theme.gap(3),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.gap(1),
  },
  muted: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  link: {
    fontFamily: theme.fonts.sans.semibold,
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: '600',
  },
}))
