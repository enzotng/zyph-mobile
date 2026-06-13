import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { CurrencyPicker } from '@/components/currency-picker'
import { DestinationField } from '@/components/destination-field'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { TripDatesField } from '@/components/trip-dates-field'
import { Surface } from '@/components/ui'
import { useFxRates } from '@/features/fx'
import { type CreateTripValues, createTripSchema, useCreateTrip } from '@/features/trips'
import { withAlpha } from '@/lib/color'

function FieldIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useUnistyles()
  return (
    <Surface
      width={40}
      height={40}
      radius={theme.radius.sm}
      borderWidth={0}
      color={withAlpha(theme.colors.primary, 0.12)}
      style={styles.fieldIcon}
    >
      <Ionicons name={name} size={20} color={theme.colors.primary} />
    </Surface>
  )
}

export default function NewTripScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const createTrip = useCreateTrip()
  const { data: fx } = useFxRates()
  // Offer every currency the ECB feed provides (all are guaranteed convertible), anchored on EUR.
  const currencies = useMemo(() => {
    const rest = fx
      ? Object.keys(fx.rates)
          .filter((c) => c !== 'EUR')
          .sort()
      : []
    return ['EUR', ...rest]
  }, [fx])
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(createTripSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      destination: '',
      currency: 'EUR',
      startDate: null,
      endDate: null,
      latitude: null,
      longitude: null,
    },
  })

  const startDate = useWatch({ control, name: 'startDate' })
  const endDate = useWatch({ control, name: 'endDate' })
  const destination = useWatch({ control, name: 'destination' })

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
    <Screen
      title={t('newTrip.title')}
      showBack
      footer={
        <Button
          label={createTrip.isPending ? t('newTrip.submitting') : t('newTrip.submit')}
          onPress={handleSubmit(onSubmit)}
          disabled={createTrip.isPending || !isValid}
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

          <View style={styles.fieldRow}>
            <FieldIcon name="location-outline" />
            <View style={styles.fieldInput}>
              <DestinationField
                label={t('tripForm.destination')}
                value={destination}
                error={errors.destination?.message}
                onChangeText={(text) => {
                  setValue('destination', text, { shouldValidate: true })
                  setValue('latitude', null)
                  setValue('longitude', null)
                }}
                onSelectPlace={(place) => {
                  setValue('destination', place.label, { shouldValidate: true })
                  setValue('latitude', place.lat)
                  setValue('longitude', place.lng)
                }}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <View>
                <CurrencyPicker
                  label={t('tripForm.currency')}
                  value={field.value}
                  currencies={currencies}
                  onChange={field.onChange}
                />
                {errors.currency?.message ? (
                  <Text style={styles.error}>{errors.currency.message}</Text>
                ) : null}
              </View>
            )}
          />

          <TripDatesField
            startDate={startDate}
            endDate={endDate}
            onChange={(next) => {
              setValue('startDate', next.startDate, { shouldValidate: true })
              setValue('endDate', next.endDate, { shouldValidate: true })
            }}
            error={errors.endDate?.message}
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
  error: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.destructive,
    marginTop: theme.gap(1),
  },
}))
