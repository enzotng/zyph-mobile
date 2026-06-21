import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { z } from 'zod'

import { ZyphMark } from '@/components/brand/zyph-mark'
import { Button } from '@/components/button'
import { TextField } from '@/components/text-field'
import { makeEmailSchema, requestPasswordReset } from '@/features/auth'
import { withAlpha } from '@/lib/color'

type ForgotPasswordValues = { email: string }

export default function ForgotPasswordScreen() {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const schema = useMemo(() => z.object({ email: makeEmailSchema(t) }), [t])
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: ForgotPasswordValues) {
    setSubmitting(true)
    try {
      await requestPasswordReset(values.email)
      setSent(true)
    } catch (error) {
      Alert.alert(
        t('auth.forgotPassword.errorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <BrandLockup />

        <View
          style={[styles.iconCircle, { backgroundColor: withAlpha(theme.colors.primary, 0.1) }]}
        >
          <Ionicons name="mail-unread-outline" size={40} color={theme.colors.primary} />
        </View>

        <View style={styles.heading}>
          <Text style={styles.title}>{t('auth.forgotPassword.sentTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.forgotPassword.sentBody')}</Text>
        </View>

        <View style={styles.footer}>
          <Link href="/(auth)/sign-in" style={styles.link}>
            {t('auth.forgotPassword.backToSignIn')}
          </Link>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        hitSlop={8}
        style={styles.backTile}
      >
        <Ionicons name="chevron-back" size={20} color={theme.colors.foreground} />
      </Pressable>
      <BrandLockup />

      <View style={styles.heading}>
        <Text style={styles.title}>{t('auth.forgotPassword.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.forgotPassword.subtitle')}</Text>
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

      <View style={styles.action}>
        <Button
          label={submitting ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
          onPress={handleSubmit(onSubmit)}
          disabled={submitting}
        />
      </View>

      <View style={styles.footer}>
        <Link href="/(auth)/sign-in" style={styles.link}>
          {t('auth.forgotPassword.backToSignIn')}
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
  backTile: {
    position: 'absolute',
    top: rt.insets.top + theme.gap(2),
    left: theme.gap(6),
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  iconCircle: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.gap(1),
  },
  link: {
    fontFamily: theme.fonts.sans.semibold,
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: '600',
  },
}))
