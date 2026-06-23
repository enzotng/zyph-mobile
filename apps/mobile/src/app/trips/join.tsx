import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Surface } from '@/components/ui'
import { type JoinTripValues, joinTripSchema, useJoinTrip } from '@/features/group'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

export default function JoinTripScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { theme } = useUnistyles()
  const joinTrip = useJoinTrip()
  // Prefilled when opened from an invite deep link (zyph://trips/join?code=...).
  const linkCode = paramString(useLocalSearchParams<{ code?: string }>().code).toUpperCase()
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinTripValues>({
    resolver: zodResolver(joinTripSchema),
    defaultValues: { code: linkCode },
  })

  const code = useWatch({ control, name: 'code' })

  // Stable across renders so the auto-join effect below does not re-run on every render.
  const onSubmit = useCallback(
    async (values: JoinTripValues) => {
      try {
        const tripId = await joinTrip.mutateAsync(values.code)
        haptics.success()
        router.replace({ pathname: '/trips/[id]', params: { id: tripId } })
      } catch (error) {
        haptics.error()
        Alert.alert(
          t('joinTrip.errorTitle'),
          error instanceof Error ? error.message : t('joinTrip.errorBody'),
        )
      }
    },
    [joinTrip, router, t],
  )

  // Auto-join once when arriving from a deep link: the code is prefilled, so submit immediately.
  // On failure the form stays with the code filled for a manual retry.
  const autoJoined = useRef(false)
  useEffect(() => {
    if (!autoJoined.current && linkCode.length >= 4) {
      autoJoined.current = true
      void handleSubmit(onSubmit)()
    }
  }, [linkCode, handleSubmit, onSubmit])

  return (
    <Screen
      title={t('joinTrip.title')}
      showBack
      footer={
        <Button
          label={t('joinTrip.submit')}
          onPress={handleSubmit(onSubmit)}
          disabled={joinTrip.isPending || code.length < 4}
          loading={joinTrip.isPending}
        />
      }
    >
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <Surface
            width={64}
            height={64}
            radius={theme.radius.lg}
            borderWidth={0}
            color={withAlpha(theme.colors.primary, 0.1)}
            style={styles.hero}
          >
            <Ionicons name="enter-outline" size={32} color={theme.colors.primary} />
          </Surface>

          <Text style={styles.title}>{t('joinTrip.heading')}</Text>
          <Text style={styles.subtitle}>{t('joinTrip.subtitle')}</Text>

          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <View style={styles.codeWrap}>
                <TextField
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="ZYPH-XXXX"
                  value={field.value}
                  onChangeText={(value) => field.onChange(value.toUpperCase())}
                  onBlur={field.onBlur}
                  error={errors.code?.message}
                  style={styles.codeInput}
                />
              </View>
            )}
          />
        </ScrollView>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  flex: {
    flex: 1,
    marginHorizontal: -theme.gap(6),
  },
  body: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(6),
    paddingBottom: theme.gap(6),
    alignItems: 'center',
    gap: theme.gap(4),
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: theme.colors.foreground,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 22,
  },
  codeWrap: {
    width: '100%',
    marginTop: theme.gap(2),
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 2,
    fontFamily: theme.fonts.display.semibold,
  },
}))
