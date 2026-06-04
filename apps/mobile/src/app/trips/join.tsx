import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
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

export default function JoinTripScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { theme } = useUnistyles()
  const joinTrip = useJoinTrip()
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinTripValues>({
    resolver: zodResolver(joinTripSchema),
    defaultValues: { code: '' },
  })

  const code = useWatch({ control, name: 'code' })

  async function onSubmit(values: JoinTripValues) {
    try {
      const tripId = await joinTrip.mutateAsync(values.code)
      router.replace({ pathname: '/trips/[id]', params: { id: tripId } })
    } catch (error) {
      Alert.alert(
        t('joinTrip.errorTitle'),
        error instanceof Error ? error.message : t('joinTrip.errorBody'),
      )
    }
  }

  return (
    <Screen title={t('joinTrip.title')} showBack>
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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

        <View style={styles.footer}>
          <Button
            label={joinTrip.isPending ? t('joinTrip.submitting') : t('joinTrip.submit')}
            onPress={handleSubmit(onSubmit)}
            disabled={joinTrip.isPending || code.length < 4}
          />
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
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
  footer: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(3),
    paddingBottom: rt.insets.bottom + theme.gap(3),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
}))
