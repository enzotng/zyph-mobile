import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Text, type TextInput, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { DestinationField } from '@/components/destination-field'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { TripDatesField } from '@/components/trip-dates-field'
import { Spinner } from '@/components/ui'
import { type CreateTripValues, createTripSchema, useTrip, useUpdateTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

export default function EditTripScreen() {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { data: trip, isLoading } = useTrip(tripId)
  const updateTrip = useUpdateTrip()
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(createTripSchema),
    // Keep the user's in-progress edits if the trip query refetches mid-edit - otherwise RHF would
    // overwrite the form from the new `values` and silently drop unsaved changes.
    resetOptions: { keepDirtyValues: true },
    values: trip
      ? {
          title: trip.title,
          destination: trip.destination ?? '',
          currency: trip.currency,
          startDate: trip.start_date,
          endDate: trip.end_date,
          latitude: trip.latitude,
          longitude: trip.longitude,
        }
      : {
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

  // Keyboard "next"/"done" chaining: title hands focus to currency, currency submits the form.
  const currencyRef = useRef<TextInput>(null)
  const submit = handleSubmit(onSubmit)

  async function onSubmit(values: CreateTripValues) {
    try {
      await updateTrip.mutateAsync({ id: tripId, ...values })
      router.back()
    } catch (error) {
      Alert.alert(
        t('tripForm.updateError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  if (isLoading) {
    return (
      <Screen title={t('tripForm.editTitle')} showBack>
        <Spinner />
      </Screen>
    )
  }

  if (!trip) {
    return (
      <Screen showBack>
        <View style={styles.center}>
          <Text style={styles.notFound}>{t('tripForm.notFound')}</Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen
      title={t('tripForm.editTitle')}
      showBack
      scroll
      footer={
        <Button
          label={updateTrip.isPending ? t('common.saving') : t('common.save')}
          onPress={submit}
          disabled={updateTrip.isPending}
        />
      }
    >
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextField
            label={t('tripForm.title')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.title?.message}
            returnKeyType="next"
            onSubmitEditing={() => currencyRef.current?.focus()}
            blurOnSubmit={false}
          />
        )}
      />

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

      <Controller
        control={control}
        name="currency"
        render={({ field }) => (
          <TextField
            ref={currencyRef}
            label={t('tripForm.currency')}
            autoCapitalize="characters"
            maxLength={3}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.currency?.message}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
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
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
}))
