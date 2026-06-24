import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { ZyphMark } from '@/components/brand/zyph-mark'
import { Button } from '@/components/button'
import { TextField } from '@/components/text-field'
import {
  AppleButton,
  makeSignUpSchema,
  type SignUpValues,
  signInWithApple,
  signInWithGoogle,
  signUp,
} from '@/features/auth'
import { haptics } from '@/lib/haptics'

export default function SignUpScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [appleSubmitting, setAppleSubmitting] = useState(false)
  const busy = submitting || googleSubmitting || appleSubmitting
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(makeSignUpSchema(t)),
    defaultValues: { displayName: '', email: '', password: '' },
  })

  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)

  async function onSubmit(values: SignUpValues) {
    setSubmitting(true)
    try {
      const { session } = await signUp(values)
      // Avec la confirmation par e-mail activée il n'y a pas encore de session -> on demande de confirmer.
      // Si une session existe (confirmation désactivée), la garde d'authentification route vers l'accueil.
      if (!session) {
        haptics.success()
        router.replace('/(auth)/check-email')
      }
    } catch (error) {
      haptics.error()
      Alert.alert(
        t('auth.signUp.errorTitle'),
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandLockup />

        <View style={styles.heading}>
          <Text style={styles.title}>{t('auth.signUp.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.signUp.subtitle')}</Text>
        </View>

        <Controller
          control={control}
          name="displayName"
          render={({ field }) => (
            <TextField
              label={t('auth.fields.name')}
              placeholder={t('auth.fields.namePlaceholder')}
              autoCapitalize="words"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.displayName?.message}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              ref={emailRef}
              label={t('auth.fields.email')}
              placeholder={t('auth.fields.emailPlaceholder')}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.email?.message}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
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
              ref={passwordRef}
              secureTextEntry
              autoComplete="new-password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.password?.message}
              returnKeyType="go"
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          )}
        />

        <View style={styles.action}>
          <Button
            label={t('auth.signUp.submit')}
            onPress={handleSubmit(onSubmit)}
            disabled={busy}
            loading={submitting}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.orSignUpWith')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.social}>
          <AppleButton onPress={onApple} disabled={busy} />
          <Button
            variant="secondary"
            icon="logo-google"
            label={googleSubmitting ? t('auth.google.signingIn') : t('auth.google.continue')}
            onPress={onGoogle}
            disabled={busy}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.muted}>{t('auth.signUp.hasAccount')}</Text>
          <Link href="/(auth)/sign-in" style={styles.link}>
            {t('auth.signIn.submit')}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flexGrow: 1,
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
    fontSize: 30,
    color: theme.colors.foreground,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
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
