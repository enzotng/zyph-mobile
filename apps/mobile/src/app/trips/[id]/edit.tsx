import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
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
    formState: { errors },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(createTripSchema),
    values: trip
      ? { title: trip.title, destination: trip.destination ?? '', currency: trip.currency }
      : { title: '', destination: '', currency: 'EUR' },
  })

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
      <Screen title={t('tripForm.editTitle')}>
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
    <Screen title={t('tripForm.editTitle')} scroll>
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
          />
        )}
      />

      <Controller
        control={control}
        name="destination"
        render={({ field }) => (
          <TextField
            label={t('tripForm.destination')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.destination?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="currency"
        render={({ field }) => (
          <TextField
            label={t('tripForm.currency')}
            autoCapitalize="characters"
            maxLength={3}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.currency?.message}
          />
        )}
      />

      <Button
        label={updateTrip.isPending ? t('common.saving') : t('common.save')}
        onPress={handleSubmit(onSubmit)}
        disabled={updateTrip.isPending}
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
