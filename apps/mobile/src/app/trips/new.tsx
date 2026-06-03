import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Segmented, Squircle } from '@/components/ui'
import { type CreateTripValues, createTripSchema, useCreateTrip } from '@/features/trips'
import { withAlpha } from '@/lib/color'

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR €' },
  { value: 'USD', label: 'USD $' },
  { value: 'GBP', label: 'GBP £' },
]

function FieldIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useUnistyles()
  return (
    <Squircle
      width={40}
      height={40}
      radius={theme.radius.sm}
      borderWidth={0}
      color={withAlpha(theme.colors.primary, 0.12)}
      style={styles.fieldIcon}
    >
      <Ionicons name={name} size={20} color={theme.colors.primary} />
    </Squircle>
  )
}

export default function NewTripScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const createTrip = useCreateTrip()
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(createTripSchema),
    mode: 'onChange',
    defaultValues: { title: '', destination: '', currency: 'EUR' },
  })

  async function onSubmit(values: CreateTripValues) {
    try {
      const trip = await createTrip.mutateAsync(values)
      router.replace({ pathname: '/trips/[id]', params: { id: trip.id } })
    } catch (error) {
      Alert.alert(
        t('newTrip.errorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  return (
    <Screen title={t('newTrip.title')} showBack>
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Controller
            control={control}
            name="title"
            render={({ field }) => (
              <View style={styles.fieldRow}>
                <FieldIcon name="airplane-outline" />
                <View style={styles.fieldInput}>
                  <TextField
                    label={t('tripForm.title')}
                    placeholder={t('tripForm.titlePlaceholder')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.title?.message}
                  />
                </View>
              </View>
            )}
          />

          <Controller
            control={control}
            name="destination"
            render={({ field }) => (
              <View style={styles.fieldRow}>
                <FieldIcon name="location-outline" />
                <View style={styles.fieldInput}>
                  <TextField
                    label={t('tripForm.destination')}
                    placeholder={t('tripForm.destinationPlaceholder')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.destination?.message}
                  />
                </View>
              </View>
            )}
          />

          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <View>
                <Text style={styles.label}>{t('tripForm.currency')}</Text>
                <Segmented
                  options={CURRENCY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
                {errors.currency?.message ? (
                  <Text style={styles.error}>{errors.currency.message}</Text>
                ) : null}
              </View>
            )}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={createTrip.isPending ? t('newTrip.submitting') : t('newTrip.submit')}
            onPress={handleSubmit(onSubmit)}
            disabled={createTrip.isPending || !isValid}
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
    paddingTop: theme.gap(4),
    paddingBottom: theme.gap(6),
    gap: theme.gap(4),
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.gap(3),
  },
  fieldIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.gap(1),
  },
  fieldInput: {
    flex: 1,
  },
  label: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    marginBottom: theme.gap(2),
  },
  error: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.destructive,
    marginTop: theme.gap(1),
  },
  footer: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(3),
    paddingBottom: rt.insets.bottom + theme.gap(3),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
}))
